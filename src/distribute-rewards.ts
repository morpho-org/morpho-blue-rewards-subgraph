import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { Market, MorphoTx, Position, PositionRewards, RewardsRate } from "../generated/schema";

import { INITIAL_INDEX } from "./emission-data-provider";
import { setupUser } from "./morpho";
import { PositionType } from "./utils";

const ONE_YEAR = BigInt.fromI32(365 * 24 * 60 * 60);
const WAD = BigInt.fromI32(1e18 as i32);
export function getMarket(marketId: Bytes): Market {
  let market = Market.load(marketId);
  if (!market) {
    log.critical("Market {} not found", [marketId.toHexString()]);
    return market!;
  }

  return market;
}

export function setupPosition(marketId: Bytes, userAddress: Bytes): Position {
  const positionId = userAddress.concat(marketId);
  let position = Position.load(positionId);

  if (!position) {
    position = new Position(positionId);
    position.user = setupUser(userAddress).id;
    position.market = marketId;
    position.supplyShares = BigInt.zero();
    position.borrowShares = BigInt.zero();
    position.collateral = BigInt.zero();
    position.save();
  }

  return position;
}
export function distributeRewards(morphoTx: MorphoTx): void {
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

export function distributeRewards(marketId: Bytes, userAddress: Bytes | null, timestamp: BigInt): void {
  const market = getMarket(marketId);

  const position = userAddress !== null ? setupPosition(marketId, userAddress) : null;

  const marketRewardsProgram = market.rewardsRates.load();
  for (let i = 0; i < marketRewardsProgram.length; i++) {
    const updatedRewards = updateRewardsRate(marketRewardsProgram[i], timestamp);
    updatedRewards.save();

    if (position) {
      const updatedPosition = accruePositionRewardsForOneRate(updatedRewards, position);
      updatedPosition.save();
    }
  }
}

export function updateRewardsRate(rewardsRate: RewardsRate, timestamp: BigInt): RewardsRate {
  const timeDelta = timestamp.minus(rewardsRate.lastUpdateTimestamp);
  if (!timeDelta.ge(BigInt.zero())) {
    log.critical("Invalid time delta {} for rewards rate {}", [timeDelta.toString(), rewardsRate.id.toHexString()]);
    return rewardsRate;
  }

  const market = getMarket(rewardsRate.market);

  if (!market.totalSupplyShares.isZero() && !rewardsRate.supplyRatePerYear.isZero()) {
    const supplyAccrued = rewardsRate.supplyRatePerYear
      .times(timeDelta)
      .times(WAD)
      .div(ONE_YEAR.times(market.totalSupplyShares));
    rewardsRate.supplyIndex = rewardsRate.supplyIndex.plus(supplyAccrued);
  }

  if (!market.totalBorrowShares.isZero() && !rewardsRate.borrowRatePerYear.isZero()) {
    const borrowAccrued = rewardsRate.borrowRatePerYear
      .times(timeDelta)
      .times(WAD)
      .div(ONE_YEAR.times(market.totalBorrowShares));
    rewardsRate.borrowIndex = rewardsRate.borrowIndex.plus(borrowAccrued);
  }

  if (market.totalCollateral.isZero() || rewardsRate.collateralRatePerYear.isZero()) {
    const collateralAccrued = rewardsRate.collateralRatePerYear
      .times(timeDelta)
      .times(WAD)
      .div(ONE_YEAR.times(market.totalCollateral));
    rewardsRate.collateralIndex = rewardsRate.collateralIndex.plus(collateralAccrued);
  }

  rewardsRate.lastUpdateTimestamp = timestamp;

  return rewardsRate;
}

export function accruePositionRewardsForOneRate(rewardsRate: RewardsRate, position: Position): PositionRewards {
  // We first update the indexes

  const positionRewardsId = position.id.concat(rewardsRate.id);
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

  positionRewards.positionSupplyAccrued = positionRewards.positionSupplyAccrued.plus(
    position.supplyShares.times(rewardsRate.supplyIndex.minus(positionRewards.positionSupplyIndex)).div(WAD),
  );
  positionRewards.positionBorrowAccrued = positionRewards.positionBorrowAccrued.plus(
    position.borrowShares.times(rewardsRate.borrowIndex.minus(positionRewards.positionBorrowIndex)).div(WAD),
  );
  positionRewards.positionCollateralAccrued = positionRewards.positionCollateralAccrued.plus(
    position.collateral.times(rewardsRate.collateralIndex.minus(positionRewards.positionCollateralIndex)).div(WAD),
  );

  positionRewards.positionSupplyIndex = rewardsRate.supplyIndex;
  positionRewards.positionBorrowIndex = rewardsRate.borrowIndex;
  positionRewards.positionCollateralIndex = rewardsRate.collateralIndex;

  return positionRewards;
}
