import {Address, BigInt, Bytes, log} from "@graphprotocol/graph-ts"
import {
  MorphoBlue,
  AccrueInterest,
  Borrow,
  CreateMarket,
  EnableIrm,
  EnableLltv,
  FlashLoan,
  IncrementNonce,
  Liquidate,
  Repay,
  SetAuthorization,
  SetFee,
  SetFeeRecipient,
  SetOwner,
  Supply,
  Withdraw,
  WithdrawCollateral, SupplyCollateral
} from "../generated/MorphoBlue/MorphoBlue"
import {_FeeRecipient, Market, MarketEpoch} from "../generated/schema";
import {syncEpochs} from "./syncEpochs";
import {accrueMarketRewards} from "./accrueMarketRewards";
import {accrueUserRewards} from "./accrueUserRewards";
import {isRewardedMarket} from "./whitelist";


export function handleAccrueInterest(event: AccrueInterest): void {

  if(!isRewardedMarket(event.params.id)) {
    return;
  }
  const feeRecipient = _FeeRecipient.load("1");
  if(feeRecipient === null && !event.params.feeShares.isZero()) {
    log.critical("Fee recipient not set, but fee shares are not zero", []);
  } else {
    if(feeRecipient !== null) {
      syncEpochs(event.block);
      const market = accrueMarketRewards(event.params.id, event.block);
      accrueUserRewards(market, Address.fromBytes(feeRecipient.feeReceiver), event.params.feeShares, event.block);
    }
  }
}

export function handleBorrow(event: Borrow): void {}

export function handleCreateMarket(event: CreateMarket): void {
  const currentEpoch = syncEpochs(event.block);
  if(!isRewardedMarket(event.params.id)) {
    return;
  }
    let market = new Market(event.params.id);
    market.supplyShares = BigInt.zero();
    market.supplyShares = BigInt.zero();

    if(currentEpoch.epoch !== null) {
      // TODO: do we really want to allow distribution on not already existing markets?
      const marketEpoch = MarketEpoch.load(event.params.id.toHexString() + "-" + currentEpoch.epoch!);
        if(marketEpoch != null) {
          market.lastEpoch = marketEpoch.id;
        }
    }
    market.lastCheckTimestamp = event.block.timestamp;
    market.rewardsAccrued = BigInt.zero();
    market.save();
}

export function handleEnableIrm(event: EnableIrm): void {}

export function handleEnableLltv(event: EnableLltv): void {}

export function handleFlashLoan(event: FlashLoan): void {}

export function handleIncrementNonce(event: IncrementNonce): void {}

export function handleLiquidate(event: Liquidate): void {}

export function handleRepay(event: Repay): void {}

export function handleSetAuthorization(event: SetAuthorization): void {}

export function handleSetFee(event: SetFee): void {}

export function handleSetFeeRecipient(event: SetFeeRecipient): void {
  syncEpochs(event.block);

  let feeRecipient = _FeeRecipient.load("1");
  if(feeRecipient === null) {
    feeRecipient = new _FeeRecipient("1");
  }
  feeRecipient.feeReceiver = event.params.newFeeRecipient;
}

export function handleSetOwner(event: SetOwner): void {}

export function handleSupply(event: Supply): void {
  if(!isRewardedMarket(event.params.id)) {
    return;
  }
  syncEpochs(event.block);
  const market = accrueMarketRewards(event.params.id, event.block);
  accrueUserRewards(market, event.params.onBehalf, event.params.shares, event.block);
}

export function handleSupplyCollateral(event: SupplyCollateral): void {}

export function handleWithdraw(event: Withdraw): void {
  if(!isRewardedMarket(event.params.id)) {
    return;
  }
  syncEpochs(event.block);
  const market = accrueMarketRewards(event.params.id, event.block);
  accrueUserRewards(market, event.params.onBehalf, event.params.shares.neg(), event.block);
}

export function handleWithdrawCollateral(event: WithdrawCollateral): void {}
