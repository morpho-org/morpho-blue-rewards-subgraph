import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";

import { Balance, Epoch, Market, MarketEpoch, MarketEpochUser, User } from "../generated/schema";

import { INITIAL_INDEX } from "./constants";
import { getEpochFromTimestamp, syncEpochs, getNextMarketEpoch } from "./syncEpochs";

/**
 * Accrue the rewards for one market user epoch.
 * We consider that the market epoch are all updated before.
 */
export function accrueOneEpochUserRewards(
  marketEpoch: MarketEpoch,
  user: User,
  userBalance: Balance,
  situation: string,
): void {
  const epoch = Epoch.load(marketEpoch.epoch.toString());
  if (epoch == null) {
    log.critical("{}: Epoch not found: {}", [situation, marketEpoch.epoch.toString()]);
    return;
  }
  let marketEpochUser = MarketEpochUser.load(marketEpoch.id + "-" + userBalance.user.toHexString());
  if (marketEpochUser == null) {
    marketEpochUser = new MarketEpochUser(marketEpoch.id + "-" + userBalance.user.toHexString());
    marketEpochUser.marketEpoch = marketEpoch.id;
    marketEpochUser.user = userBalance.user;
    marketEpochUser.rewardsAccrued = BigInt.zero();
    marketEpochUser.rewardsSupplyIndex = INITIAL_INDEX;
  }
  const rewardsAccrued = marketEpoch.rewardsSupplyIndex
    .minus(marketEpochUser.rewardsSupplyIndex)
    .times(userBalance.supplyShares)
    .div(INITIAL_INDEX);
  marketEpochUser.rewardsAccrued = marketEpochUser.rewardsAccrued.plus(rewardsAccrued);
  marketEpochUser.rewardsSupplyIndex = marketEpoch.rewardsSupplyIndex;

  userBalance.rewardsAccrued = userBalance.rewardsAccrued.plus(rewardsAccrued);
  userBalance.lastUpdateTimestamp = marketEpoch.lastUpdateTimestamp;

  user.rewardsAccrued = user.rewardsAccrued.plus(rewardsAccrued);
  user.save();
  marketEpochUser.save();
}
/**
 * SuppliedShares is negative for a withdrawal.
 */
export function accrueUserRewards(
  market: Market,
  userAddress: Address,
  suppliedShares: BigInt,
  block: ethereum.Block,
): void {
  const currentEpoch = syncEpochs(block);
  let user = User.load(userAddress);
  if (!user) {
    user = new User(userAddress);
    user.rewardsAccrued = BigInt.zero();
    user.save();
  }
  let userBalance = Balance.load(userAddress.toHexString() + "-" + market.id.toHexString());
  if (!userBalance) {
    userBalance = new Balance(userAddress.toHexString() + "-" + market.id.toHexString());
    userBalance.market = market.id;
    userBalance.user = userAddress;
    userBalance.supplyShares = BigInt.zero();
    userBalance.lastEpochUpdate = currentEpoch.id;
    userBalance.lastUpdateTimestamp = block.timestamp;
    userBalance.save();
  }
  if (userBalance.supplyShares === BigInt.zero()) {
    userBalance.supplyShares = BigInt.zero();
    userBalance.lastEpochUpdate = currentEpoch.id;
    userBalance.lastUpdateTimestamp = block.timestamp;
    userBalance.save();
  }

  let epochOfLastUpdate = getEpochFromTimestamp(userBalance.lastUpdateTimestamp, null);
  if (!epochOfLastUpdate) {
    // There is no epoch for the last update timestamp, so we check if there is an epoch that has started since the last update
    const nextMarketEpoch = getNextMarketEpoch(market, userBalance.lastUpdateTimestamp);
    if (nextMarketEpoch) {
      const epoch = Epoch.load(nextMarketEpoch.epoch);
      if (epoch == null) {
        log.critical("accrueUserRewards: Epoch not found: {}", [nextMarketEpoch.epoch]);
        return;
      }
      if (epoch.start <= userBalance.lastUpdateTimestamp) {
        epochOfLastUpdate = epoch;
      }
    }
  }
  let epoch: Epoch | null = null;
  if (currentEpoch.epoch) epoch = Epoch.load(currentEpoch.epoch!);

  while (epochOfLastUpdate !== null && epochOfLastUpdate !== epoch) {
    // And then we compute all the epochs of the past

    const marketEpoch = MarketEpoch.load(market.id.toHexString() + "-" + epochOfLastUpdate.id);
    if (marketEpoch == null) {
      // There is no rewards for this market into this epoch
      if (epochOfLastUpdate.nextEpoch) epochOfLastUpdate = Epoch.load(epochOfLastUpdate.nextEpoch!);
    } else {
      accrueOneEpochUserRewards(marketEpoch, user, userBalance, "accrueUserRewards");
    }
  }
  // And then handle the current epoch, the not finished one.
  if (epoch) {
    const marketEpoch = MarketEpoch.load(market.id.toHexString() + "-" + epoch.id);
    if (marketEpoch !== null) {
      accrueOneEpochUserRewards(marketEpoch, user, userBalance, "accrueUserRewards");
    }
  }

  // And we finally update the user balance
  // The amount is negative for a withdrawal
  userBalance.supplyShares = userBalance.supplyShares.plus(suppliedShares);
  market.supplyShares = market.supplyShares.plus(suppliedShares);
  market.save();
  userBalance.save();
}
