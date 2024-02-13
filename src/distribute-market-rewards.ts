import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import {
  MarketRewardsRate,
  MorphoTx,
  Position,
  PositionReward,
} from "../generated/schema";

import { ONE_YEAR, PRECISION } from "./constants";
import {
  getMarket,
  setupUserRewardProgramAccrual,
  setupPosition,
  setupPositionReward,
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
  marketRewards: MarketRewardsRate,
  timestamp: BigInt
): MarketRewardsRate {
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
    const scaledSupplyAccrued = marketRewards.supplyRatePerYear
      .times(timeDelta)
      .times(PRECISION)
      .div(ONE_YEAR);

    marketRewards.lastTotalSupplyRewards =
      marketRewards.lastTotalSupplyRewards.plus(
        scaledSupplyAccrued.div(PRECISION)
      );

    marketRewards.supplyRewardsIndex = marketRewards.supplyRewardsIndex.plus(
      scaledSupplyAccrued.div(market.totalSupplyShares)
    );
  }

  if (market.totalBorrowShares.gt(BigInt.zero())) {
    const scaledBorrowAccrued = marketRewards.borrowRatePerYear
      .times(timeDelta)
      .times(PRECISION)
      .div(ONE_YEAR);
    marketRewards.lastTotalBorrowRewards =
      marketRewards.lastTotalBorrowRewards.plus(
        scaledBorrowAccrued.div(PRECISION)
      );

    marketRewards.borrowRewardsIndex = marketRewards.borrowRewardsIndex.plus(
      scaledBorrowAccrued.div(market.totalBorrowShares)
    );
  }

  if (market.totalCollateral.gt(BigInt.zero())) {
    const scaledCollateralAccrued = marketRewards.collateralRatePerYear
      .times(timeDelta)
      .times(PRECISION)
      .div(ONE_YEAR);
    marketRewards.lastTotalCollateralRewards =
      marketRewards.lastTotalCollateralRewards.plus(
        scaledCollateralAccrued.div(PRECISION)
      );

    marketRewards.collateralRewardsIndex =
      marketRewards.collateralRewardsIndex.plus(
        scaledCollateralAccrued.div(market.totalCollateral)
      );
  }

  marketRewards.lastUpdateTimestamp = timestamp;

  marketRewards.save();
  return marketRewards;
}
export function accruePositionRewardForOneRate(
  marketRewardsRates: MarketRewardsRate,
  positionId: Bytes
): PositionReward {
  const position = Position.load(positionId);
  if (!position) {
    log.critical("Position {} not found", [positionId.toHexString()]);
    return new PositionReward(Bytes.empty());
  }

  const positionRewards = setupPositionReward(
    marketRewardsRates.id,
    position.id
  );
  const totalSupplyRewards = marketRewardsRates.supplyRewardsIndex
    .minus(positionRewards.lastPositionSupplyIndex)
    .times(position.supplyShares)
    .div(PRECISION);

  positionRewards.positionSupplyAccrued =
    positionRewards.positionSupplyAccrued.plus(totalSupplyRewards);

  positionRewards.lastPositionSupplyIndex =
    marketRewardsRates.supplyRewardsIndex;

  const totalBorrowRewards = marketRewardsRates.borrowRewardsIndex
    .minus(positionRewards.lastPositionBorrowIndex)
    .times(position.borrowShares)
    .div(PRECISION);

  positionRewards.positionBorrowAccrued =
    positionRewards.positionBorrowAccrued.plus(totalBorrowRewards);

  positionRewards.lastPositionBorrowIndex =
    marketRewardsRates.borrowRewardsIndex;

  const totalCollateralRewards = marketRewardsRates.collateralRewardsIndex
    .minus(positionRewards.lastPositionCollateralIndex)
    .times(position.collateral)
    .div(PRECISION);

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
      accruePositionRewardForOneRate(updatedRewards, position.id);
    }
  }
}
