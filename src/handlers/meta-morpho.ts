import { Address, Bytes } from "@graphprotocol/graph-ts";

import {
  AccrueFee as AccrueFeeEvent,
  Deposit as DepositEvent,
  Transfer as TransferEvent,
  Withdraw as WithdrawEvent,
} from "../../generated/MetaMorpho/MetaMorpho";
import { MetaMorphoTx } from "../../generated/schema";
import { distributeMetaMorphoRewards } from "../distribute-metamorpho-rewards";
import { setupMetaMorpho } from "../initializers";
import { generateLogId } from "../utils";

export function handleAccrueFee(event: AccrueFeeEvent): void {
  if (event.params.feeShares.isZero()) return;

  const id = generateLogId(event);

  const mmTx = new MetaMorphoTx(id);
  mmTx.metaMorpho = setupMetaMorpho(event.address).id;
  // TODO: retrieve the fee receiver.
  mmTx.user = setupMetaMorpho(Address.zero()).id;
  mmTx.shares = event.params.feeShares;
  mmTx.timestamp = event.block.timestamp;

  mmTx.txHash = event.transaction.hash;
  mmTx.txIndex = event.transaction.index;
  mmTx.logIndex = event.logIndex;
  mmTx.blockNumber = event.block.number;
  mmTx.save();

  distributeMetaMorphoRewards(mmTx);
}

export function handleDeposit(event: DepositEvent): void {
  const id = generateLogId(event);

  const mmTx = new MetaMorphoTx(id);
  mmTx.metaMorpho = setupMetaMorpho(event.address).id;

  mmTx.user = setupMetaMorpho(event.params.owner).id;
  mmTx.shares = event.params.shares;
  mmTx.timestamp = event.block.timestamp;

  mmTx.txHash = event.transaction.hash;
  mmTx.txIndex = event.transaction.index;
  mmTx.logIndex = event.logIndex;
  mmTx.blockNumber = event.block.number;
  mmTx.save();

  distributeMetaMorphoRewards(mmTx);
}

export function handleTransfer(event: TransferEvent): void {
  // Skip mint & burn transfer events.
  if (
    event.params.from.equals(Address.zero()) ||
    event.params.to.equals(Address.zero())
  )
    return;
  const idFrom = generateLogId(event).concat(Bytes.fromI32(1 as i32));

  const mmTxFrom = new MetaMorphoTx(idFrom);
  mmTxFrom.metaMorpho = setupMetaMorpho(event.address).id;

  mmTxFrom.user = setupMetaMorpho(event.params.from).id;
  mmTxFrom.shares = event.params.value.neg();
  mmTxFrom.timestamp = event.block.timestamp;

  mmTxFrom.txHash = event.transaction.hash;
  mmTxFrom.txIndex = event.transaction.index;
  mmTxFrom.logIndex = event.logIndex;
  mmTxFrom.blockNumber = event.block.number;
  mmTxFrom.save();

  distributeMetaMorphoRewards(mmTxFrom);

  const idTo = generateLogId(event).concat(Bytes.fromI32(1 as i32));

  const mmTxTo = new MetaMorphoTx(idTo);
  mmTxTo.metaMorpho = setupMetaMorpho(event.address).id;

  mmTxTo.user = setupMetaMorpho(event.params.to).id;
  mmTxTo.shares = event.params.value;
  mmTxTo.timestamp = event.block.timestamp;

  mmTxTo.txHash = event.transaction.hash;
  mmTxTo.txIndex = event.transaction.index;
  mmTxTo.logIndex = event.logIndex;
  mmTxTo.blockNumber = event.block.number;
  mmTxTo.save();

  distributeMetaMorphoRewards(mmTxTo);
}

export function handleWithdraw(event: WithdrawEvent): void {
  const id = generateLogId(event);

  const mmTx = new MetaMorphoTx(id);
  mmTx.metaMorpho = setupMetaMorpho(event.address).id;

  mmTx.user = setupMetaMorpho(event.params.owner).id;
  mmTx.shares = event.params.shares.neg();
  mmTx.timestamp = event.block.timestamp;

  mmTx.txHash = event.transaction.hash;
  mmTx.txIndex = event.transaction.index;
  mmTx.logIndex = event.logIndex;
  mmTx.blockNumber = event.block.number;
  mmTx.save();

  distributeMetaMorphoRewards(mmTx);
}
