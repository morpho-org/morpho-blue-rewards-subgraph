import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import {
  MarketRewardsRates,
  MorphoTx,
  Position,
  PositionRewards,
} from "../generated/schema";

import { ONE_YEAR, RAY } from "./constants";
import {
  getMarket,
  setupUserRewardProgramAccrual,
  setupPosition,
  setupPositionRewards,
} from "./initializers";
import { PositionType } from "./utils";

export function handleMorphoTx(morphoTx: MorphoTx): void {
  distributeMarketRewards(morphoTx.market, morphoTx.user, morphoTx.timestamp);

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

/**
 * It accrues the rewards distributed for one given rewards rate of a market & program
 * It is editing the rewardsRate entity and it saves it at the end.
 */
export function updateTotalDistributed(
  marketRewards: MarketRewardsRates,
  timestamp: BigInt
): MarketRewardsRates {
  const timeDelta = timestamp.minus(marketRewards.lastUpdateTimestamp);
  if (!timeDelta.ge(BigInt.zero())) {
    log.critical("Invalid time delta {} for rewards rate {}", [
      timeDelta.toString(),
      marketRewards.id.toHexString(),
    ]);
    return marketRewards;
  }
  const market = getMarket(marketRewards.market);

  if (market.totalSupplyShares.gt(BigInt.zero())) {
    const supplyAccrued = marketRewards.supplyRatePerYear
      .times(timeDelta)
      .div(ONE_YEAR);
    marketRewards.lastTotalSupplyRewards =
      marketRewards.lastTotalSupplyRewards.plus(supplyAccrued);

    marketRewards.supplyRewardsIndex = marketRewards.supplyRewardsIndex.plus(
      supplyAccrued.times(RAY).div(market.totalSupplyShares)
    );
  }

  if (market.totalBorrowShares.gt(BigInt.zero())) {
    const borrowAccrued = marketRewards.borrowRatePerYear
      .times(timeDelta)
      .div(ONE_YEAR);
    marketRewards.lastTotalBorrowRewards =
      marketRewards.lastTotalBorrowRewards.plus(borrowAccrued);

    marketRewards.borrowRewardsIndex = marketRewards.borrowRewardsIndex.plus(
      borrowAccrued.times(RAY).div(market.totalBorrowShares)
    );
  }

  if (market.totalCollateral.gt(BigInt.zero())) {
    const collateralAccrued = marketRewards.collateralRatePerYear
      .times(timeDelta)
      .div(ONE_YEAR);
    marketRewards.lastTotalCollateralRewards =
      marketRewards.lastTotalCollateralRewards.plus(collateralAccrued);

    marketRewards.collateralRewardsIndex =
      marketRewards.collateralRewardsIndex.plus(
        collateralAccrued.times(RAY).div(market.totalCollateral)
      );
  }

  marketRewards.lastUpdateTimestamp = timestamp;

  marketRewards.save();
  return marketRewards;
}
export function accruePositionRewardsForOneRate(
  marketRewardsRates: MarketRewardsRates,
  positionId: Bytes
): PositionRewards {
  const position = Position.load(positionId);
  if (!position) {
    log.critical("Position {} not found", [positionId.toHexString()]);
    return new PositionRewards(Bytes.empty());
  }

  const positionRewards = setupPositionRewards(
    marketRewardsRates.id,
    position.id
  );
  const totalSupplyRewards = marketRewardsRates.supplyRewardsIndex
    .minus(positionRewards.lastPositionSupplyIndex)
    .times(position.supplyShares)
    .div(RAY);

  positionRewards.positionSupplyAccrued =
    positionRewards.positionSupplyAccrued.plus(totalSupplyRewards);

  positionRewards.lastPositionSupplyIndex =
    marketRewardsRates.supplyRewardsIndex;

  const totalBorrowRewards = marketRewardsRates.borrowRewardsIndex
    .minus(positionRewards.lastPositionBorrowIndex)
    .times(position.borrowShares)
    .div(RAY);

  positionRewards.positionBorrowAccrued =
    positionRewards.positionBorrowAccrued.plus(totalBorrowRewards);

  positionRewards.lastPositionBorrowIndex =
    marketRewardsRates.borrowRewardsIndex;

  const totalCollateralRewards = marketRewardsRates.collateralRewardsIndex
    .minus(positionRewards.lastPositionCollateralIndex)
    .times(position.collateral)
    .div(RAY);

  positionRewards.positionCollateralAccrued =
    positionRewards.positionCollateralAccrued.plus(totalCollateralRewards);

  positionRewards.lastPositionCollateralIndex =
    marketRewardsRates.collateralRewardsIndex;

  positionRewards.save();

  // Then accrue the rewards for the user accrual program
  const userAccrualProgram = setupUserRewardProgramAccrual(
    position.user,
    marketRewardsRates.rewardProgram
  );

  userAccrualProgram.supplyRewardsAccrued =
    userAccrualProgram.supplyRewardsAccrued.plus(totalSupplyRewards);
  userAccrualProgram.borrowRewardsAccrued =
    userAccrualProgram.borrowRewardsAccrued.plus(totalBorrowRewards);
  userAccrualProgram.collateralRewardsAccrued =
    userAccrualProgram.collateralRewardsAccrued.plus(totalCollateralRewards);

  userAccrualProgram.save();

  return positionRewards;
}

export function distributeMarketRewards(
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
