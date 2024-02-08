import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import {
  Market,
  MetaMorpho,
  MetaMorphoPosition,
  MetaMorphoPositionReward,
  MetaMorphoRewardsAccrual,
  Position,
  PositionReward,
  URD,
  User,
  UserRewardProgramAccrual,
} from "../generated/schema";

import { hashBytes } from "./utils";

export function getMarket(marketId: Bytes): Market {
  let market = Market.load(marketId);
  if (!market) {
    log.critical("Market {} not found", [marketId.toHexString()]);
    return market!;
  }

  return market;
}

export function setupUser(address: Bytes): User {
  let user = User.load(address);
  if (!user) {
    user = new User(address);
    user.save();
  }
  return user;
}

export function setupMarket(marketId: Bytes): Market {
  let market = Market.load(marketId);
  if (!market) {
    market = new Market(marketId);
    market.totalSupplyShares = BigInt.zero();
    market.totalBorrowShares = BigInt.zero();
    market.totalCollateral = BigInt.zero();

    market.save();
  }

  return market;
}

export function setupPosition(marketId: Bytes, userAddress: Bytes): Position {
  const positionId = hashBytes(marketId.concat(userAddress));
  let position = Position.load(positionId);

  if (!position) {
    position = new Position(positionId);
    position.user = setupUser(userAddress).id;
    position.market = marketId;
    position.supplyShares = BigInt.zero();
    position.borrowShares = BigInt.zero();
    position.collateral = BigInt.zero();
    const metamorpho = MetaMorpho.load(userAddress);

    if (metamorpho !== null) {
      position.metaMorpho = metamorpho.id;
    }

    position.save();
  }

  return position;
}

export function setupPositionReward(
  marketRewardsId: Bytes,
  positionId: Bytes
): PositionReward {
  const positionRewardsId = hashBytes(positionId.concat(marketRewardsId));
  let positionRewards = PositionReward.load(positionRewardsId);

  if (!positionRewards) {
    positionRewards = new PositionReward(positionRewardsId);
    positionRewards.rewardsRate = marketRewardsId;
    positionRewards.position = positionId;
    positionRewards.positionSupplyAccrued = BigInt.zero();
    positionRewards.positionBorrowAccrued = BigInt.zero();
    positionRewards.positionCollateralAccrued = BigInt.zero();
    positionRewards.lastPositionSupplyIndex = BigInt.zero();
    positionRewards.lastPositionBorrowIndex = BigInt.zero();
    positionRewards.lastPositionCollateralIndex = BigInt.zero();
  }
  return positionRewards;
}

export function setupURD(address: Address): URD {
  let urd = URD.load(address);
  if (!urd) {
    urd = new URD(address);
    urd.save();
  }
  return urd;
}

export function setupMetaMorpho(address: Bytes): MetaMorpho {
  let metaMorpho = MetaMorpho.load(address);
  if (!metaMorpho) {
    log.critical("MetaMorpho {} not found", [address.toHexString()]);
    return metaMorpho!;
  }
  return metaMorpho;
}

export function setupMetaMorphoPosition(
  userAddress: Bytes,
  metaMorphoAddress: Bytes
): MetaMorphoPosition {
  const mmPositionId = hashBytes(userAddress.concat(metaMorphoAddress));
  let metaMorphoPosition = MetaMorphoPosition.load(mmPositionId);
  if (!metaMorphoPosition) {
    metaMorphoPosition = new MetaMorphoPosition(mmPositionId);
    metaMorphoPosition.user = setupUser(userAddress).id;
    metaMorphoPosition.metaMorpho = setupMetaMorpho(metaMorphoAddress).id;
    metaMorphoPosition.shares = BigInt.zero();
    metaMorphoPosition.save();
  }
  return metaMorphoPosition;
}

export function setupUserRewardProgramAccrual(
  userId: Bytes,
  rewardProgramId: Bytes
): UserRewardProgramAccrual {
  let userAccrualId = hashBytes(userId.concat(rewardProgramId));
  let userAccrualProgram = UserRewardProgramAccrual.load(userAccrualId);
  if (!userAccrualProgram) {
    userAccrualProgram = new UserRewardProgramAccrual(userAccrualId);
    userAccrualProgram.user = userId;
    userAccrualProgram.rewardProgram = rewardProgramId;
    userAccrualProgram.supplyRewardsAccrued = BigInt.zero();
    userAccrualProgram.borrowRewardsAccrued = BigInt.zero();
    userAccrualProgram.collateralRewardsAccrued = BigInt.zero();

    // check if the user is a metamorpho
    const metaMorpho = MetaMorpho.load(userId);
    if (metaMorpho !== null) {
      userAccrualProgram.metaMorpho = metaMorpho.id;
    }
  }
  return userAccrualProgram;
}

export function setupMetaMorphoRewardsAccrual(
  metaMorphoId: Bytes,
  rewardProgramId: Bytes
): MetaMorphoRewardsAccrual {
  let mmRewardsAccrualId = hashBytes(metaMorphoId.concat(rewardProgramId));

  let mmRewardsAccrual = MetaMorphoRewardsAccrual.load(mmRewardsAccrualId);
  if (!mmRewardsAccrual) {
    mmRewardsAccrual = new MetaMorphoRewardsAccrual(mmRewardsAccrualId);
    mmRewardsAccrual.metaMorpho = metaMorphoId;
    mmRewardsAccrual.rewardProgram = rewardProgramId;
    mmRewardsAccrual.supplyRewardsAccrued = BigInt.zero();

    mmRewardsAccrual.lastSupplyIndex = BigInt.zero();
    mmRewardsAccrual.save();
  }
  return mmRewardsAccrual;
}

export function setupMetaMorphoPositionReward(
  mmRewardsAccrualId: Bytes,
  mmPositionId: Bytes
): MetaMorphoPositionReward {
  const mmPositionRewardId = hashBytes(mmPositionId.concat(mmRewardsAccrualId));
  let mmPositionReward = MetaMorphoPositionReward.load(mmPositionRewardId);

  if (!mmPositionReward) {
    mmPositionReward = new MetaMorphoPositionReward(mmPositionRewardId);
    mmPositionReward.rewardsAccrual = mmRewardsAccrualId;
    mmPositionReward.position = mmPositionId;
    mmPositionReward.rewardsAccrued = BigInt.zero();
    mmPositionReward.lastIndex = BigInt.zero();
  }
  return mmPositionReward;
}
