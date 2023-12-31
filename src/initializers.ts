import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import { Market, Position, URD, User } from "../generated/schema";

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
  // TODO: what if a rewards program was initialized before market creation?
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

export function setupURD(address: Address): URD {
  let urd = URD.load(address);
  if (!urd) {
    urd = new URD(address);
    urd.save();
  }
  return urd;
}
