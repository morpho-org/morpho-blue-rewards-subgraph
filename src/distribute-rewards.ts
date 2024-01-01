import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import {
  MorphoTx,
  Position,
  PositionRewards,
  RewardsRate,
  UserRewardProgramAccrual,
} from "../generated/schema";

import { INITIAL_INDEX, ONE_YEAR, WAD } from "./constants";
import { getMarket, setupPosition } from "./initializers";
import { hashBytes, PositionType } from "./utils";

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
    const updatedRewards = updateRewardsRate(
      marketRewardsProgram[i],
      timestamp
    );
    updatedRewards.save();

    if (position) {
      const initialPositionRewards = PositionRewards.load(
        position.id.concat(updatedRewards.id)
      );

      const updatedPosition = accruePositionRewardsForOneRate(
        updatedRewards,
        position.id
      );
      // Then accrue the rewards for the user accrual program
      let userAccrualId = hashBytes(
        position.user.concat(updatedRewards.rewardProgram)
      );
      let userAccrualProgram = UserRewardProgramAccrual.load(userAccrualId);
      if (!userAccrualProgram) {
        userAccrualProgram = new UserRewardProgramAccrual(userAccrualId);
        userAccrualProgram.user = position.user;
        userAccrualProgram.rewardProgram = updatedRewards.rewardProgram;
        userAccrualProgram.supplyRewardsAccrued = BigInt.zero();
        userAccrualProgram.borrowRewardsAccrued = BigInt.zero();
        userAccrualProgram.collateralRewardsAccrued = BigInt.zero();
      }

      if (initialPositionRewards) {
        userAccrualProgram.supplyRewardsAccrued =
          userAccrualProgram.supplyRewardsAccrued.plus(
            updatedPosition.positionSupplyAccrued.minus(
              initialPositionRewards.positionSupplyAccrued
            )
          );

        userAccrualProgram.borrowRewardsAccrued =
          userAccrualProgram.borrowRewardsAccrued.plus(
            updatedPosition.positionBorrowAccrued.minus(
              initialPositionRewards.positionBorrowAccrued
            )
          );

        userAccrualProgram.collateralRewardsAccrued =
          userAccrualProgram.collateralRewardsAccrued.plus(
            updatedPosition.positionCollateralAccrued.minus(
              initialPositionRewards.positionCollateralAccrued
            )
          );
      } else {
        userAccrualProgram.supplyRewardsAccrued =
          userAccrualProgram.supplyRewardsAccrued.plus(
            updatedPosition.positionSupplyAccrued
          );

        userAccrualProgram.borrowRewardsAccrued =
          userAccrualProgram.borrowRewardsAccrued.plus(
            updatedPosition.positionBorrowAccrued
          );
        userAccrualProgram.collateralRewardsAccrued =
          userAccrualProgram.collateralRewardsAccrued.plus(
            updatedPosition.positionCollateralAccrued
          );
      }

      userAccrualProgram.save();
      updatedPosition.save();
    }
  }
}

export function updateRewardsRate(
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

  const market = getMarket(rewardsRate.market);

  if (
    !market.totalSupplyShares.isZero() &&
    !rewardsRate.supplyRatePerYear.isZero()
  ) {
    const supplyAccrued = rewardsRate.supplyRatePerYear
      .times(timeDelta)
      .times(WAD)
      .div(ONE_YEAR.times(market.totalSupplyShares));
    rewardsRate.supplyIndex = rewardsRate.supplyIndex.plus(supplyAccrued);
  }

  if (
    !market.totalBorrowShares.isZero() &&
    !rewardsRate.borrowRatePerYear.isZero()
  ) {
    const borrowAccrued = rewardsRate.borrowRatePerYear
      .times(timeDelta)
      .times(WAD)
      .div(ONE_YEAR.times(market.totalBorrowShares));
    rewardsRate.borrowIndex = rewardsRate.borrowIndex.plus(borrowAccrued);
  }

  if (
    market.totalCollateral.isZero() ||
    rewardsRate.collateralRatePerYear.isZero()
  ) {
    const collateralAccrued = rewardsRate.collateralRatePerYear
      .times(timeDelta)
      .times(WAD)
      .div(ONE_YEAR.times(market.totalCollateral));
    rewardsRate.collateralIndex =
      rewardsRate.collateralIndex.plus(collateralAccrued);
  }

  rewardsRate.lastUpdateTimestamp = timestamp;

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
  // We first update the indexes

  const positionRewardsId = hashBytes(position.id.concat(rewardsRate.id));
  let positionRewards = PositionRewards.load(positionRewardsId);

  if (!positionRewards) {
    positionRewards = new PositionRewards(positionRewardsId);
    positionRewards.rewardsRate = rewardsRate.id;
    positionRewards.position = position.id;
    positionRewards.positionSupplyIndex = INITIAL_INDEX;
    positionRewards.positionBorrowIndex = INITIAL_INDEX;
    positionRewards.positionCollateralIndex = INITIAL_INDEX;
    positionRewards.positionSupplyAccrued = BigInt.zero();
    positionRewards.positionBorrowAccrued = BigInt.zero();
    positionRewards.positionCollateralAccrued = BigInt.zero();
  }

  positionRewards.positionSupplyAccrued =
    positionRewards.positionSupplyAccrued.plus(
      position.supplyShares
        .times(
          rewardsRate.supplyIndex.minus(positionRewards.positionSupplyIndex)
        )
        .div(WAD)
    );
  positionRewards.positionBorrowAccrued =
    positionRewards.positionBorrowAccrued.plus(
      position.borrowShares
        .times(
          rewardsRate.borrowIndex.minus(positionRewards.positionBorrowIndex)
        )
        .div(WAD)
    );
  positionRewards.positionCollateralAccrued =
    positionRewards.positionCollateralAccrued.plus(
      position.collateral
        .times(
          rewardsRate.collateralIndex.minus(
            positionRewards.positionCollateralIndex
          )
        )
        .div(WAD)
    );

  positionRewards.positionSupplyIndex = rewardsRate.supplyIndex;
  positionRewards.positionBorrowIndex = rewardsRate.borrowIndex;
  positionRewards.positionCollateralIndex = rewardsRate.collateralIndex;

  return positionRewards;
}
