import {
  AccrueFee as AccrueFeeEvent,
  Deposit as DepositEvent,
  Transfer as TransferEvent,
  Withdraw as WithdrawEvent,
} from "../../generated/MetaMorpho/MetaMorpho";

export function handleAccrueFee(event: AccrueFeeEvent): void {}

export function handleDeposit(event: DepositEvent): void {}

export function handleTransfer(event: TransferEvent): void {}

export function handleWithdraw(event: WithdrawEvent): void {}
