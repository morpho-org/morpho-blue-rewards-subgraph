import { BigInt } from "@graphprotocol/graph-ts";

import {
  MetaMorphoPosition,
  MetaMorphoPositionRewards,
  MetaMorphoTx,
  UserRewardProgramAccrual,
} from "../generated/schema";

import { distributeRewards } from "./distribute-rewards";
import {
  setupMetaMorpho,
  setupMetaMorphoPosition,
  setupUser,
} from "./initializers";
import { hashBytes } from "./utils";

const VIRTUAL_ASSETS = BigInt.fromString("1");

function toRewardsAssets(
  shares: BigInt,
  totalRewardsAssets: BigInt,
  totalShares: BigInt,
  underlyingDecimals: BigInt
): BigInt {
  const wadDecimals = BigInt.fromI32(18);
  const virtualShares = underlyingDecimals.gt(wadDecimals)
    ? BigInt.zero()
    : wadDecimals.minus(underlyingDecimals);

  return shares
    .times(totalRewardsAssets.plus(VIRTUAL_ASSETS))
    .div(totalShares.plus(virtualShares));
}

function accrueMetaMorphoPositionRewardsForOneProgram(
  mmBlueRewardsAccrual: UserRewardProgramAccrual,
  mmPosition: MetaMorphoPosition
): MetaMorphoPositionRewards {
  const metaMorpho = setupMetaMorpho(mmPosition.metaMorpho);

  const mmPositionRewardsId = hashBytes(
    mmPosition.id.concat(mmBlueRewardsAccrual.id)
  );
  let mmPositionRewards = MetaMorphoPositionRewards.load(mmPositionRewardsId);

  if (!mmPositionRewards) {
    mmPositionRewards = new MetaMorphoPositionRewards(mmPositionRewardsId);
    mmPositionRewards.rewardsProgram = mmBlueRewardsAccrual.rewardProgram;
    mmPositionRewards.position = mmPosition.id;
    mmPositionRewards.rewardsAccrued = BigInt.zero();
  }

  const userAccrued = toRewardsAssets(
    mmPosition.shares,
    mmBlueRewardsAccrual.supplyRewardsAccrued,
    metaMorpho.totalShares,
    metaMorpho.underlyingDecimals
  );

  // We reduce the accrued rewards from the total accrued rewards, since they are now accounted in the user's position.
  mmBlueRewardsAccrual.supplyRewardsAccrued =
    mmBlueRewardsAccrual.supplyRewardsAccrued.minus(userAccrued);
  mmBlueRewardsAccrual.save();

  mmPositionRewards.rewardsAccrued =
    mmPositionRewards.rewardsAccrued.plus(userAccrued);

  mmPositionRewards.save();
  return mmPositionRewards;
}

export function distributeMetaMorphoRewards(mmTx: MetaMorphoTx): void {
  // First, we need to accrue the rewards, per RewardProgram, for the vault on the different markets.

  let metaMorphoAsBlueUser = setupUser(mmTx.metaMorpho);

  const bluePositions = metaMorphoAsBlueUser.positions.load();

  for (let i = 0; i < bluePositions.length; i++) {
    const bluePosition = bluePositions[i];
    distributeRewards(bluePosition.market, bluePosition.user, mmTx.timestamp);
  }

  // Refresh entity
  metaMorphoAsBlueUser = setupUser(mmTx.metaMorpho);

  const metaMorphoRewardsAccruals =
    metaMorphoAsBlueUser.rewardProgramAccruals.load();

  const position = setupMetaMorphoPosition(mmTx.user, mmTx.metaMorpho);

  // Then, we need to accrue the rewards for the vault, per RewardProgram, for the given user.
  for (let i = 0; i < metaMorphoRewardsAccruals.length; i++) {
    const metaMorphoRewardsAccrual = metaMorphoRewardsAccruals[i];

    // Then, we update the rewards for the given user.
    const positionRewards = accrueMetaMorphoPositionRewardsForOneProgram(
      metaMorphoRewardsAccrual,
      position
    );
    positionRewards.save();
  }

  // shares are negative for withdrawals
  position.shares = position.shares.plus(mmTx.shares);
  position.save();

  const metaMorpho = setupMetaMorpho(mmTx.metaMorpho);
  metaMorpho.totalShares = metaMorpho.totalShares.plus(mmTx.shares);
  metaMorpho.save();
}
