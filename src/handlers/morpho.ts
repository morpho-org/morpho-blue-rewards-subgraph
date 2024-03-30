import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";

import {
  AccrueInterest as AccrueInterestEvent,
  Borrow as BorrowEvent,
  Liquidate as LiquidateEvent,
  Repay as RepayEvent,
  Supply as SupplyEvent,
  SupplyCollateral as SupplyCollateralEvent,
  Withdraw as WithdrawEvent,
  WithdrawCollateral as WithdrawCollateralEvent,
  SetFeeRecipient as SetFeeRecipientEvent,
  CreateMarket as CreateMarketEvent,
} from "../../generated/Morpho/Morpho";
import {
  Market,
  MetaMorpho,
  MorphoFeeRecipient,
  MorphoTx,
} from "../../generated/schema";
import { handleMorphoTx } from "../distribute-market-rewards";
import { getMarket, setupUser } from "../initializers";
import { transferMetaMorphoShares } from "../metamorpho-transfers";
import { generateLogId, PositionType } from "../utils";

export function handleAccrueInterest(event: AccrueInterestEvent): void {
  if (event.params.feeShares.isZero()) return;

  const feeRecipient = MorphoFeeRecipient.load(Bytes.empty());
  if (!feeRecipient) {
    log.critical("Morpho not found", []);
    return;
  }

  // We consider the fees accrued as a supply.
  const id = generateLogId(event);
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.SUPPLY;
  morphoTx.user = feeRecipient.feeRecipient;
  morphoTx.market = getMarket(event.params.id).id;
  morphoTx.shares = event.params.feeShares;

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();

  handleMorphoTx(morphoTx);
}

export function handleBorrow(event: BorrowEvent): void {
  const id = generateLogId(event);
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.BORROW;
  morphoTx.user = setupUser(event.params.onBehalf).id;
  morphoTx.market = getMarket(event.params.id).id;
  morphoTx.shares = event.params.shares;

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();

  handleMorphoTx(morphoTx);
}

export function handleCreateMarket(event: CreateMarketEvent): void {
  if (Market.load(event.params.id) !== null) {
    log.critical("Market {} already exists", [event.params.id.toHexString()]);
  }
  const market = new Market(event.params.id);
  market.totalSupplyShares = BigInt.zero();
  market.totalBorrowShares = BigInt.zero();
  market.totalCollateral = BigInt.zero();
  market.loanToken = event.params.marketParams.loanToken;
  market.collateralToken = event.params.marketParams.collateralToken;
  market.save();
}

export function handleLiquidate(event: LiquidateEvent): void {
  const market = getMarket(event.params.id);
  const repayId = generateLogId(event).concat(
    Bytes.fromUTF8(PositionType.BORROW)
  );

  const repayMorphoTx = new MorphoTx(repayId);
  repayMorphoTx.type = PositionType.BORROW;
  repayMorphoTx.user = setupUser(event.params.borrower).id;
  repayMorphoTx.market = market.id;
  const totalShares = event.params.repaidShares.plus(
    event.params.badDebtShares
  );
  repayMorphoTx.shares = totalShares.neg();

  repayMorphoTx.timestamp = event.block.timestamp;

  repayMorphoTx.txHash = event.transaction.hash;
  repayMorphoTx.txIndex = event.transaction.index;
  repayMorphoTx.logIndex = event.logIndex;

  repayMorphoTx.blockNumber = event.block.number;
  repayMorphoTx.save();
  handleMorphoTx(repayMorphoTx);

  const withdrawCollatId = generateLogId(event).concat(
    Bytes.fromUTF8(PositionType.COLLATERAL)
  );

  const withdrawCollatTx = new MorphoTx(withdrawCollatId);
  withdrawCollatTx.type = PositionType.COLLATERAL;
  withdrawCollatTx.user = setupUser(event.params.borrower).id;
  withdrawCollatTx.market = market.id;
  withdrawCollatTx.shares = event.params.seizedAssets.neg();

  withdrawCollatTx.timestamp = event.block.timestamp;

  withdrawCollatTx.txHash = event.transaction.hash;
  withdrawCollatTx.txIndex = event.transaction.index;
  withdrawCollatTx.logIndex = event.logIndex;

  withdrawCollatTx.blockNumber = event.block.number;
  withdrawCollatTx.save();

  handleMorphoTx(withdrawCollatTx);

  if (MetaMorpho.load(market.collateralToken) !== null) {
    // there is a liquidation of a MetaMorpho as collateral market. We handle it as a transfer from the borrower to the liquidator
    transferMetaMorphoShares(
      event,
      market.collateralToken,
      event.params.borrower,
      event.params.caller,
      event.params.seizedAssets
    );
  }
}

export function handleRepay(event: RepayEvent): void {
  const id = generateLogId(event);
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.BORROW;
  morphoTx.user = setupUser(event.params.onBehalf).id;
  morphoTx.market = getMarket(event.params.id).id;
  morphoTx.shares = event.params.shares.neg();

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();

  handleMorphoTx(morphoTx);
}

export function handleSupply(event: SupplyEvent): void {
  const id = generateLogId(event);

  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.SUPPLY;
  morphoTx.user = setupUser(event.params.onBehalf).id;
  morphoTx.market = getMarket(event.params.id).id;
  morphoTx.shares = event.params.shares;

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();

  handleMorphoTx(morphoTx);
}

export function handleSupplyCollateral(event: SupplyCollateralEvent): void {
  const market = getMarket(event.params.id);
  const id = generateLogId(event);
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.COLLATERAL;
  morphoTx.user = setupUser(event.params.onBehalf).id;
  morphoTx.market = market.id;
  morphoTx.shares = event.params.assets;

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();

  handleMorphoTx(morphoTx);
  if (
    MetaMorpho.load(market.collateralToken) !== null &&
    !event.params.onBehalf.equals(event.params.caller)
  ) {
    // there is a supply of a MetaMorpho as collateral market.
    // if there is a direct supply (onBehalf == caller), we are just skipping the transfer in the vault transfer function (to = blue)
    // if there is a supply on behalf of someone else, we handle it as a transfer from the caller to the onBehalf user

    transferMetaMorphoShares(
      event,
      market.collateralToken,
      event.params.caller,
      event.params.onBehalf,
      event.params.assets
    );
  }
}

export function handleWithdraw(event: WithdrawEvent): void {
  const id = generateLogId(event);
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.SUPPLY;
  morphoTx.user = setupUser(event.params.onBehalf).id;
  morphoTx.market = getMarket(event.params.id).id;
  morphoTx.shares = event.params.shares.neg();

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();

  handleMorphoTx(morphoTx);
}

export function handleWithdrawCollateral(event: WithdrawCollateralEvent): void {
  const market = getMarket(event.params.id);

  const id = generateLogId(event);
  const morphoTx = new MorphoTx(id);
  morphoTx.type = PositionType.COLLATERAL;
  morphoTx.user = setupUser(event.params.onBehalf).id;
  morphoTx.market = market.id;
  morphoTx.shares = event.params.assets.neg();

  morphoTx.timestamp = event.block.timestamp;

  morphoTx.txHash = event.transaction.hash;
  morphoTx.txIndex = event.transaction.index;
  morphoTx.logIndex = event.logIndex;

  morphoTx.blockNumber = event.block.number;
  morphoTx.save();

  handleMorphoTx(morphoTx);

  if (
    MetaMorpho.load(market.collateralToken) !== null &&
    !event.params.onBehalf.equals(event.params.receiver)
  ) {
    // there is a supply of a MetaMorpho as collateral market.
    // if there is a direct withdrawal (onBehalf == receiver), we are just skipping the transfer in the vault transfer function (to = blue)
    // if there is a withdrawal on behalf of someone else, we handle it as a transfer from the morpho user (onBehalf) to the receiver

    transferMetaMorphoShares(
      event,
      market.collateralToken,
      event.params.onBehalf,
      event.params.receiver,
      event.params.assets
    );
  }
}

export function handleSetFeeRecipient(event: SetFeeRecipientEvent): void {
  let morpho = MorphoFeeRecipient.load(Bytes.empty());
  if (!morpho) {
    morpho = new MorphoFeeRecipient(Bytes.empty());
  }
  morpho.feeRecipient = setupUser(event.params.newFeeRecipient).id;
  morpho.save();
}
