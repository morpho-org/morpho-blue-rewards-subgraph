import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

import { MetaMorphoTx } from "../generated/schema";

import { distributeMetaMorphoRewards } from "./distribute-metamorpho-rewards";
import {
  setupMetaMorpho,
  setupMetaMorphoPosition,
  setupUser,
} from "./initializers";
import { generateLogId } from "./utils";

/**
 * Transfer MetaMorpho shares from one user to another.
 * Used by the classic transfer function of ERC4626.
 *
 * This is also used to virtually account a user that has deposited a shares as collateral into a Morpho Market.
 * transferFrom(sender, onBehalf) for a supplyCollateral.
 * transferFrom(onBehalf, receiver) for a withdrawCollateral.
 * The Morpho user is still accounting his shares even if they are deposited into a Market.
 *
 * NB: you can account for only one transfer per event, since IDs will clash.
 */
export function transferMetaMorphoShares(
  event: ethereum.Event,
  metaMorpho: Bytes,
  from: Bytes,
  to: Bytes,
  amount: BigInt
): void {
  if (from.equals(to)) return;

  const idFrom = generateLogId(event).concat(Bytes.fromI32(1 as i32));

  const mmTxFrom = new MetaMorphoTx(idFrom);
  mmTxFrom.metaMorpho = setupMetaMorpho(event.address).id;

  mmTxFrom.user = setupUser(from).id;
  mmTxFrom.position = setupMetaMorphoPosition(to, metaMorpho).id;
  mmTxFrom.shares = amount.neg();

  mmTxFrom.timestamp = event.block.timestamp;
  mmTxFrom.txHash = event.transaction.hash;
  mmTxFrom.txIndex = event.transaction.index;
  mmTxFrom.logIndex = event.logIndex;
  mmTxFrom.blockNumber = event.block.number;
  mmTxFrom.save();

  distributeMetaMorphoRewards(mmTxFrom);

  const idTo = generateLogId(event).concat(Bytes.fromI32(2 as i32));

  const mmTxTo = new MetaMorphoTx(idTo);
  mmTxTo.metaMorpho = setupMetaMorpho(event.address).id;

  mmTxTo.user = setupUser(to).id;
  mmTxTo.position = setupMetaMorphoPosition(to, event.address).id;
  mmTxTo.shares = amount;
  mmTxTo.timestamp = event.block.timestamp;

  mmTxTo.txHash = event.transaction.hash;
  mmTxTo.txIndex = event.transaction.index;
  mmTxTo.logIndex = event.logIndex;
  mmTxTo.blockNumber = event.block.number;
  mmTxTo.save();

  distributeMetaMorphoRewards(mmTxTo);
}
