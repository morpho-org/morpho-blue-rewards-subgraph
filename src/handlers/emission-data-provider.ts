import { Bytes } from "@graphprotocol/graph-ts";

import { RewardsEmissionSet as RewardsEmissionSetEvent } from "../../generated/EmissionDataProvider/EmissionDataProvider";
import {
  RateUpdateTx,
  RewardProgram,
  RewardsRate,
} from "../../generated/schema";
import { INITIAL_INDEX } from "../constants";
import { updateRewardsRate } from "../distribute-rewards";
import { setupMarket, setupURD, setupUser } from "../initializers";

export function handleRewardsEmissionSet(event: RewardsEmissionSetEvent): void {
  const rewardProgramId = event.params.sender
    .concat(event.params.rewardToken)
    .concat(event.params.urd);

  let rewardProgram = RewardProgram.load(rewardProgramId);
  if (!rewardProgram) {
    rewardProgram = new RewardProgram(rewardProgramId);
    rewardProgram.sender = setupUser(event.params.sender).id;
    rewardProgram.rewardToken = event.params.rewardToken;
    rewardProgram.urd = setupURD(event.params.urd).id;
    rewardProgram.save();
  }

  const id = rewardProgram.id.concat(event.params.market);
  let rewardsRate = RewardsRate.load(id);

  if (!rewardsRate) {
    rewardsRate = new RewardsRate(id);
    rewardsRate.supplyIndex = INITIAL_INDEX;
    rewardsRate.borrowIndex = INITIAL_INDEX;
    rewardsRate.collateralIndex = INITIAL_INDEX;
    rewardsRate.rewardProgram = rewardProgram.id;
    rewardsRate.market = setupMarket(event.params.market).id;
    rewardsRate.lastUpdateTimestamp = event.block.timestamp;
  } else {
    // Update the distribution up to the new timestamp.
    rewardsRate = updateRewardsRate(rewardsRate, event.block.timestamp);
  }

  rewardsRate.supplyRatePerYear =
    event.params.rewardsEmission.supplyRatePerYear;
  rewardsRate.borrowRatePerYear =
    event.params.rewardsEmission.borrowRatePerYear;
  rewardsRate.collateralRatePerYear =
    event.params.rewardsEmission.collateralRatePerYear;

  rewardsRate.availableAt = event.block.timestamp;

  rewardsRate.save();

  const rateUpdateTx = new RateUpdateTx(
    event.transaction.hash.concat(
      Bytes.fromHexString(event.logIndex.toHexString())
    )
  );
  // entities already set
  rateUpdateTx.sender = event.params.sender;
  rateUpdateTx.urd = event.params.urd;
  rateUpdateTx.rewardToken = event.params.rewardToken;
  rateUpdateTx.market = event.params.market;
  rateUpdateTx.supplyRatePerYear =
    event.params.rewardsEmission.supplyRatePerYear;
  rateUpdateTx.borrowRatePerYear =
    event.params.rewardsEmission.borrowRatePerYear;
  rateUpdateTx.collateralRatePerYear =
    event.params.rewardsEmission.collateralRatePerYear;
  rateUpdateTx.timestamp = event.block.timestamp;

  rateUpdateTx.txHash = event.transaction.hash;
  rateUpdateTx.txIndex = event.transaction.index;
  rateUpdateTx.logIndex = event.logIndex;

  rateUpdateTx.blockNumber = event.block.number;
  rateUpdateTx.save();
}
