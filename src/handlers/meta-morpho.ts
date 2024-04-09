import { Address, log } from "@graphprotocol/graph-ts";

import { MetaMorphoTx } from "../../generated/schema";
import {
  AccrueInterest as AccrueInterestEvent,
  Deposit as DepositEvent,
  Transfer as TransferEvent,
  Withdraw as WithdrawEvent,
  SetFeeRecipient as SetFeeRecipientEvent,
} from "../../generated/templates/MetaMorpho/MetaMorpho";
import { MORPHO_ADDRESS } from "../constants";
import { distributeMetaMorphoRewards } from "../distribute-metamorpho-rewards";
import {
  setupMetaMorpho,
  setupMetaMorphoPosition,
  setupUser,
} from "../initializers";
import { transferMetaMorphoShares } from "../metamorpho-transfers";
import { generateLogId } from "../utils";

export function handleAccrueInterest(event: AccrueInterestEvent): void {
  if (event.params.feeShares.isZero()) return;

  const mm = setupMetaMorpho(event.address);

  if (mm.feeRecipient === null) {
    log.critical("Fee recipient not set for MetaMorpho {}", [
      mm.id.toHexString(),
    ]);
    return;
  }

  const id = generateLogId(event);

  const mmTx = new MetaMorphoTx(id);
  mmTx.metaMorpho = mm.id;
  mmTx.user = setupUser(mm.feeRecipient!).id;
  mmTx.position = setupMetaMorphoPosition(mm.feeRecipient!, event.address).id;
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

  mmTx.user = setupUser(event.params.owner).id;
  mmTx.position = setupMetaMorphoPosition(event.params.owner, event.address).id;
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

  // Skip transfer to Morpho. They are handled into Morpho handlers.
  // NB: if there is a flash loan of vault shares, they are transferred back to Morpho into the same transaction, so there is no need to handle them at all.
  if (
    event.params.from.equals(MORPHO_ADDRESS) ||
    event.params.to.equals(MORPHO_ADDRESS)
  )
    return;

  transferMetaMorphoShares(
    event,
    event.address,
    event.params.from,
    event.params.to,
    event.params.value
  );
}

export function handleWithdraw(event: WithdrawEvent): void {
  const id = generateLogId(event);

  const mmTx = new MetaMorphoTx(id);
  mmTx.metaMorpho = setupMetaMorpho(event.address).id;

  mmTx.user = setupUser(event.params.owner).id;
  mmTx.position = setupMetaMorphoPosition(event.params.owner, event.address).id;
  mmTx.shares = event.params.shares.neg();
  mmTx.timestamp = event.block.timestamp;

  mmTx.txHash = event.transaction.hash;
  mmTx.txIndex = event.transaction.index;
  mmTx.logIndex = event.logIndex;
  mmTx.blockNumber = event.block.number;
  mmTx.save();

  distributeMetaMorphoRewards(mmTx);
}

export function handleSetFeeRecipient(event: SetFeeRecipientEvent): void {
  const mm = setupMetaMorpho(event.address);
  mm.feeRecipient = setupUser(event.params.newFeeRecipient).id;
  mm.save();
}
