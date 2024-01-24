import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import {
  MetaMorpho,
  MorphoTx,
  Position,
  PositionRewards,
  RewardsRate,
  UserRewardProgramAccrual,
} from "../generated/schema";

import { ONE_YEAR } from "./constants";
import { getMarket, setupPosition } from "./initializers";
import { hashBytes, PositionType } from "./utils";

// we use the same offset as the one used in Morpho, to reuse the same shares.
const VIRTUAL_SHARES = BigInt.fromString("10").pow(6 as u8);
const VIRTUAL_ASSETS = BigInt.fromString("1");
function toRewardsAssets(
  shares: BigInt,
  totalRewardsAssets: BigInt,
  totalShares: BigInt
): BigInt {
  return shares
    .times(totalRewardsAssets.plus(VIRTUAL_ASSETS))
    .div(totalShares.plus(VIRTUAL_SHARES));
}

export function handleMorphoTx(morphoTx: MorphoTx): void {
  distributeRewards(morphoTx.market, morphoTx.user, morphoTx.timestamp);

  const position = setupPosition(morphoTx.market, morphoTx.user);
  const market = getMarket(morphoTx.market);

  if (morphoTx.type === PositionType.SUPPLY) {
    position.supplyShares = position.supplyShares.plus(morphoTx.shares);
    market.totalSupplyShares = market.totalSupplyShares.plus(morphoTx.shares);
  } else if (morphoTx.type === PositionType.BORROW) {
    position.borrowShares = position.borrowShares.plus(morphoTx.shares);
    market.totalBorrowShares = market.totalBorrowShares.plus(morphoTx.shares);
  } else if (morphoTx.type === PositionType.COLLATERAL) {
    position.collateral = position.collateral.plus(morphoTx.shares);
    market.totalCollateral = market.totalCollateral.plus(morphoTx.shares);
  } else {
    log.critical("Invalid position type {}", [morphoTx.type]);
    return;
  }

  position.save();

  market.save();
}

export function distributeRewards(
  marketId: Bytes,
  userAddress: Bytes | null,
  timestamp: BigInt
): void {
  const market = getMarket(marketId);

  const position =
    userAddress !== null ? setupPosition(marketId, userAddress) : null;

  const marketRewardsProgram = market.rewardsRates.load();
  for (let i = 0; i < marketRewardsProgram.length; i++) {
    const updatedRewards = updateTotalDistributed(
      marketRewardsProgram[i],
      timestamp
    );
    updatedRewards.save();

    if (position) {
      accruePositionRewardsForOneRate(updatedRewards, position.id);
    }
  }
}

/**
 * It accrues the rewards distributed for one given rewards rate of a market & program
 * It is editing the rewardsRate entity and it saves it at the end.
 */
export function updateTotalDistributed(
  rewardsRate: RewardsRate,
  timestamp: BigInt
): RewardsRate {
  const timeDelta = timestamp.minus(rewardsRate.lastUpdateTimestamp);
  if (!timeDelta.ge(BigInt.zero())) {
    log.critical("Invalid time delta {} for rewards rate {}", [
      timeDelta.toString(),
      rewardsRate.id.toHexString(),
    ]);
    return rewardsRate;
  }

  const supplyAccrued = rewardsRate.supplyRatePerYear
    .times(timeDelta)
    .div(ONE_YEAR);
  rewardsRate.lastTotalSupplyRewards =
    rewardsRate.lastTotalSupplyRewards.plus(supplyAccrued);

  const borrowAccrued = rewardsRate.borrowRatePerYear
    .times(timeDelta)
    .div(ONE_YEAR);
  rewardsRate.lastTotalBorrowRewards =
    rewardsRate.lastTotalBorrowRewards.plus(borrowAccrued);

  const collateralAccrued = rewardsRate.collateralRatePerYear
    .times(timeDelta)
    .div(ONE_YEAR);
  rewardsRate.lastTotalCollateralRewards =
    rewardsRate.lastTotalCollateralRewards.plus(collateralAccrued);

  rewardsRate.lastUpdateTimestamp = timestamp;

  rewardsRate.save();
  return rewardsRate;
}

export function accruePositionRewardsForOneRate(
  rewardsRate: RewardsRate,
  positionId: Bytes
): PositionRewards {
  const position = Position.load(positionId);
  if (!position) {
    log.critical("Position {} not found", [positionId.toHexString()]);
    return new PositionRewards(Bytes.empty());
  }
  const market = getMarket(position.market);
  const positionRewardsId = hashBytes(position.id.concat(rewardsRate.id));
  let positionRewards = PositionRewards.load(positionRewardsId);

  if (!positionRewards) {
    positionRewards = new PositionRewards(positionRewardsId);
    positionRewards.rewardsRate = rewardsRate.id;
    positionRewards.position = position.id;
    positionRewards.positionSupplyAccrued = BigInt.zero();
    positionRewards.positionBorrowAccrued = BigInt.zero();
    positionRewards.positionCollateralAccrued = BigInt.zero();
  }

  const totalSupplyRewards = toRewardsAssets(
    position.supplyShares,
    rewardsRate.lastTotalSupplyRewards,
    market.totalSupplyShares
  );
  positionRewards.positionSupplyAccrued =
    positionRewards.positionSupplyAccrued.plus(totalSupplyRewards);
  rewardsRate.lastTotalSupplyRewards =
    rewardsRate.lastTotalSupplyRewards.minus(totalSupplyRewards);

  const totalBorrowRewards = toRewardsAssets(
    position.borrowShares,
    rewardsRate.lastTotalBorrowRewards,
    market.totalBorrowShares
  );
  positionRewards.positionBorrowAccrued =
    positionRewards.positionBorrowAccrued.plus(totalBorrowRewards);
  rewardsRate.lastTotalBorrowRewards =
    rewardsRate.lastTotalBorrowRewards.minus(totalBorrowRewards);

  const totalCollateralRewards = toRewardsAssets(
    position.collateral,
    rewardsRate.lastTotalCollateralRewards,
    market.totalCollateral
  );
  positionRewards.positionCollateralAccrued =
    positionRewards.positionCollateralAccrued.plus(totalCollateralRewards);
  rewardsRate.lastTotalCollateralRewards =
    rewardsRate.lastTotalCollateralRewards.minus(totalCollateralRewards);

  rewardsRate.save();

  // Then accrue the rewards for the user accrual program
  let userAccrualId = hashBytes(
    position.user.concat(rewardsRate.rewardProgram)
  );
  let userAccrualProgram = UserRewardProgramAccrual.load(userAccrualId);
  if (!userAccrualProgram) {
    userAccrualProgram = new UserRewardProgramAccrual(userAccrualId);
    userAccrualProgram.user = position.user;
    userAccrualProgram.rewardProgram = rewardsRate.rewardProgram;
    userAccrualProgram.supplyRewardsAccrued = BigInt.zero();
    userAccrualProgram.borrowRewardsAccrued = BigInt.zero();
    userAccrualProgram.collateralRewardsAccrued = BigInt.zero();

    // check if the user is a metamorpho
    const metamorpho = MetaMorpho.load(position.user);
    if (metamorpho !== null) {
      userAccrualProgram.metamorpho = metamorpho.id;
    }
  }

  userAccrualProgram.supplyRewardsAccrued =
    userAccrualProgram.supplyRewardsAccrued.plus(totalSupplyRewards);
  userAccrualProgram.borrowRewardsAccrued =
    userAccrualProgram.borrowRewardsAccrued.plus(totalBorrowRewards);
  userAccrualProgram.collateralRewardsAccrued =
    userAccrualProgram.collateralRewardsAccrued.plus(totalCollateralRewards);

  userAccrualProgram.save();
  positionRewards.save();

  return positionRewards;
}
