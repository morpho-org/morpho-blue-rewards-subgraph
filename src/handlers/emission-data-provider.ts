import { BigInt, log } from "@graphprotocol/graph-ts";

import { RewardsEmissionSet as RewardsEmissionSetEvent } from "../../generated/EmissionDataProvider/EmissionDataProvider";
import {
  Market,
  MarketRewardsRate,
  RateUpdateTx,
  RewardProgram,
} from "../../generated/schema";
import { updateTotalDistributed } from "../distribute-market-rewards";
import { setupURD, setupUser } from "../initializers";
import { generateLogId, hashBytes } from "../utils";

export function handleRewardsEmissionSet(event: RewardsEmissionSetEvent): void {
  if (Market.load(event.params.market) === null) {
    log.warning("Market {} not found, skipping rate definition", [
      event.params.market.toHexString(),
    ]);
    return;
  }
  const rewardProgramId = hashBytes(
    event.params.sender
      .concat(event.params.rewardToken)
      .concat(event.params.urd)
  );

  let rewardProgram = RewardProgram.load(rewardProgramId);
  if (!rewardProgram) {
    rewardProgram = new RewardProgram(rewardProgramId);
    rewardProgram.sender = setupUser(event.params.sender).id;
    rewardProgram.rewardToken = event.params.rewardToken;
    rewardProgram.urd = setupURD(event.params.urd).id;
    rewardProgram.save();
  }

  const id = hashBytes(rewardProgram.id.concat(event.params.market));
  let marketRewardsRates = MarketRewardsRate.load(id);

  if (!marketRewardsRates) {
    marketRewardsRates = new MarketRewardsRate(id);

    marketRewardsRates.supplyRewardsIndex = BigInt.zero();
    marketRewardsRates.borrowRewardsIndex = BigInt.zero();
    marketRewardsRates.collateralRewardsIndex = BigInt.zero();

    marketRewardsRates.rewardProgram = rewardProgram.id;
    marketRewardsRates.market = event.params.market; // Thanks to the check above, we know this market exists.
    marketRewardsRates.lastUpdateTimestamp = event.block.timestamp;
  } else {
    // Update the distribution up to the new timestamp.
    marketRewardsRates = updateTotalDistributed(
      marketRewardsRates,
      event.block.timestamp
    );
  }

  marketRewardsRates.supplyRatePerYear =
    event.params.rewardsEmission.supplyRewardTokensPerYear;
  marketRewardsRates.borrowRatePerYear =
    event.params.rewardsEmission.borrowRewardTokensPerYear;
  marketRewardsRates.collateralRatePerYear =
    event.params.rewardsEmission.collateralRewardTokensPerYear;

  marketRewardsRates.availableAt = event.block.timestamp;

  marketRewardsRates.save();

  const rateUpdateTx = new RateUpdateTx(generateLogId(event));
  // entities already set
  rateUpdateTx.sender = event.params.sender;
  rateUpdateTx.urd = event.params.urd;
  rateUpdateTx.rewardToken = event.params.rewardToken;
  rateUpdateTx.rewardProgram = rewardProgram.id;
  rateUpdateTx.rewardsRate = marketRewardsRates.id;
  rateUpdateTx.market = event.params.market;
  rateUpdateTx.supplyRatePerYear =
    event.params.rewardsEmission.supplyRewardTokensPerYear;
  rateUpdateTx.borrowRatePerYear =
    event.params.rewardsEmission.borrowRewardTokensPerYear;
  rateUpdateTx.collateralRatePerYear =
    event.params.rewardsEmission.collateralRewardTokensPerYear;
  rateUpdateTx.timestamp = event.block.timestamp;

  rateUpdateTx.txHash = event.transaction.hash;
  rateUpdateTx.txIndex = event.transaction.index;
  rateUpdateTx.logIndex = event.logIndex;

  rateUpdateTx.blockNumber = event.block.number;
  rateUpdateTx.save();
}
