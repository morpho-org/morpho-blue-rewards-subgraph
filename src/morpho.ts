import {
  AccrueInterest as AccrueInterestEvent,
  Borrow as BorrowEvent,
  Liquidate as LiquidateEvent,
  Repay as RepayEvent,
  Supply as SupplyEvent,
  SupplyCollateral as SupplyCollateralEvent,
  Withdraw as WithdrawEvent,
  WithdrawCollateral as WithdrawCollateralEvent
} from "../generated/Morpho/Morpho"
import {Market, MorphoTx, User} from "../generated/schema";
import {Address, BigInt, Bytes} from "@graphprotocol/graph-ts";
import {PositionType} from "./utils";

export function setupUser(address: Address): User {
  let user = User.load(address);
  if(!user) {
    user = new User(address);
    user.save();
  }
  return user;
}

export function setupMarket(marketId: Bytes): Market {
  // TODO: what if a rewards program was initialized before market creation?
  let market = Market.load(marketId);
    if(!market) {
        market = new Market(marketId);
        market.totalSupplyShares = BigInt.zero();
        market.totalBorrowShares = BigInt.zero();
        market.totalCollateral = BigInt.zero();

        market.lastUpdateTimestamp = 0; // TODO: default value?
        market.save();
    }

    return market;
}

export function handleAccrueInterest(event: AccrueInterestEvent): void {
  if(event.params.feeShares.isZero()) return;

  // We consider the fees accrued as a supply.
  const id = event.transaction.hash.concat(Bytes.fromHexString(event.logIndex.toHexString()))
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.SUPPLY;
  // TODO: retrieve the fee receiver.
  morphoTx.user = setupUser(Address.zero()).id;
  morphoTx.market = setupMarket(event.params.id).id;
  morphoTx.shares = event.params.feeShares;

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();

}

export function handleBorrow(event: BorrowEvent): void {
  const id = event.transaction.hash.concat(Bytes.fromHexString(event.logIndex.toHexString()))
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.BORROW;
  morphoTx.user = setupUser(event.params.onBehalf).id;
  morphoTx.market = setupMarket(event.params.id).id;
  morphoTx.shares = event.params.shares;

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();

}

export function handleLiquidate(event: LiquidateEvent): void {

  const repayId = event.transaction.hash.concat(Bytes.fromHexString(event.logIndex.toHexString())).concat(Bytes.fromUTF8(PositionType.BORROW));
  const repayMorphoTx = new MorphoTx(repayId);
  repayMorphoTx.type = PositionType.BORROW;
  repayMorphoTx.user = setupUser(event.params.borrower).id;
  repayMorphoTx.market = setupMarket(event.params.id).id;
  // TODO: check bad debt
  repayMorphoTx.shares = event.params.repaidShares.neg();

  repayMorphoTx.timestamp = event.block.timestamp;

  repayMorphoTx.txHash = event.transaction.hash;
  repayMorphoTx.txIndex = event.transaction.index;
  repayMorphoTx.logIndex = event.logIndex;

  repayMorphoTx.blockNumber = event.block.number;
  repayMorphoTx.save();

  const withdrawCollatId = event.transaction.hash.concat(Bytes.fromHexString(event.logIndex.toHexString())).concat(Bytes.fromUTF8(PositionType.COLLATERAL));
  const withdrawCollatTx = new MorphoTx(withdrawCollatId);
  withdrawCollatTx.type = PositionType.BORROW;
  withdrawCollatTx.user = setupUser(event.params.borrower).id;
  withdrawCollatTx.market = setupMarket(event.params.id).id;
  withdrawCollatTx.shares = event.params.seizedAssets.neg();

  withdrawCollatTx.timestamp = event.block.timestamp;

  withdrawCollatTx.txHash = event.transaction.hash;
  withdrawCollatTx.txIndex = event.transaction.index;
  withdrawCollatTx.logIndex = event.logIndex;

  withdrawCollatTx.blockNumber = event.block.number;
  withdrawCollatTx.save();
}

export function handleRepay(event: RepayEvent): void {
  const id = event.transaction.hash.concat(Bytes.fromHexString(event.logIndex.toHexString()))
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.BORROW;
  morphoTx.user = setupUser(event.params.onBehalf).id;
  morphoTx.market = setupMarket(event.params.id).id;
  morphoTx.shares = event.params.shares.neg();

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();

}

export function handleSupply(event: SupplyEvent): void {
  const id = event.transaction.hash.concat(Bytes.fromHexString(event.logIndex.toHexString()))
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.SUPPLY;
  morphoTx.user = setupUser(event.params.onBehalf).id;
  morphoTx.market = setupMarket(event.params.id).id;
  morphoTx.shares = event.params.shares;

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();

}

export function handleSupplyCollateral(event: SupplyCollateralEvent): void {

  const id = event.transaction.hash.concat(Bytes.fromHexString(event.logIndex.toHexString()))
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.COLLATERAL;
  morphoTx.user = setupUser(event.params.onBehalf).id;
  morphoTx.market = setupMarket(event.params.id).id;
  morphoTx.shares = event.params.assets;

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();
}

export function handleWithdraw(event: WithdrawEvent): void {

  const id = event.transaction.hash.concat(Bytes.fromHexString(event.logIndex.toHexString()))
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.SUPPLY;
  morphoTx.user = setupUser(event.params.onBehalf).id;
  morphoTx.market = setupMarket(event.params.id).id;
  morphoTx.shares = event.params.shares.neg();

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();
}

export function handleWithdrawCollateral(event: WithdrawCollateralEvent): void {

  const id = event.transaction.hash.concat(Bytes.fromHexString(event.logIndex.toHexString()))
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.COLLATERAL;
  morphoTx.user = setupUser(event.params.onBehalf).id;
  morphoTx.market = setupMarket(event.params.id).id;
  morphoTx.shares = event.params.assets.neg();

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();
}
