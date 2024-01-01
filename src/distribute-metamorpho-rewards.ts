import { BigInt } from "@graphprotocol/graph-ts";

import {
  MetaMorpho,
  MetaMorphoPosition,
  MetaMorphoPositionRewards,
  MetaMorphoRewards,
  MetaMorphoTx,
  UserRewardProgramAccrual,
} from "../generated/schema";

import { INITIAL_INDEX, WAD } from "./constants";
import { distributeRewards } from "./distribute-rewards";
import {
  setupMetaMorpho,
  setupMetaMorphoPosition,
  setupUser,
} from "./initializers";

function accrueMetaMorphoRewardsForOneProgram(
  metaMorpho: MetaMorpho,
  metaMorphoRewardsAccrual: UserRewardProgramAccrual
): MetaMorphoRewards {
  const metaMorphoRewardsId = metaMorphoRewardsAccrual.rewardProgram.concat(
    metaMorpho.id
  );
  let metaMorphoRewards = MetaMorphoRewards.load(metaMorphoRewardsId);
  if (!metaMorphoRewards) {
    metaMorphoRewards = new MetaMorphoRewards(metaMorphoRewardsId);
    metaMorphoRewards.metaMorpho = metaMorpho.id;
    metaMorphoRewards.program = metaMorphoRewardsAccrual.rewardProgram;
    metaMorphoRewards.lastIndex = INITIAL_INDEX;
    metaMorphoRewards.accrued = BigInt.zero();
  }
  const accruedSinceLastTx =
    metaMorphoRewardsAccrual.supplyRewardsAccrued.minus(
      metaMorphoRewards.accrued
    );
  metaMorphoRewards.lastIndex = metaMorphoRewards.lastIndex.plus(
    accruedSinceLastTx.times(WAD).div(metaMorpho.totalShares)
  );
  metaMorphoRewards.accrued = metaMorphoRewardsAccrual.supplyRewardsAccrued;
  return metaMorphoRewards;
}

function accrueMetaMorphoPositionRewardsForOneProgram(
  mmRewards: MetaMorphoRewards,
  mmPosition: MetaMorphoPosition
): MetaMorphoPositionRewards {
  const mmPositionRewardsId = mmPosition.id.concat(mmRewards.id);
  let mmPositionRewards = MetaMorphoPositionRewards.load(mmPositionRewardsId);

  if (!mmPositionRewards) {
    mmPositionRewards = new MetaMorphoPositionRewards(mmPositionRewardsId);
    mmPositionRewards.metaMorphoRewards = mmRewards.id;
    mmPositionRewards.position = mmPosition.id;
    mmPositionRewards.lastIndex = INITIAL_INDEX;
    mmPositionRewards.accrued = BigInt.zero();
  }

  const accruedSinceLastTx = mmPosition.shares.times(
    mmRewards.lastIndex.minus(mmPositionRewards.lastIndex)
  );
  mmPositionRewards.lastIndex = mmRewards.lastIndex;
  mmPositionRewards.accrued =
    mmPositionRewards.accrued.plus(accruedSinceLastTx);

  return mmPositionRewards;
}

export function distributeMetaMorphoRewards(mmTx: MetaMorphoTx): void {
  // First, we need to accrue the rewards, per RewardProgram, for the vault.

  let metaMorphoAsBlueUser = setupUser(mmTx.metaMorpho);

  const bluePositions = metaMorphoAsBlueUser.positions.load();

  for (let i = 0; i < bluePositions.length; i++) {
    const bluePosition = bluePositions[i];
    distributeRewards(bluePosition.market, bluePosition.user, mmTx.timestamp);
  }

  // Refresh entity
  metaMorphoAsBlueUser = setupUser(mmTx.metaMorpho);

  const metaMorphoRewardsAccruals =
    metaMorphoAsBlueUser.rewardProgramAccruals.load();

  const position = setupMetaMorphoPosition(mmTx.user, mmTx.metaMorpho);

  for (let i = 0; i < metaMorphoRewardsAccruals.length; i++) {
    const metaMorphoRewardsAccrual = metaMorphoRewardsAccruals[i];
    let metaMorphoRewards = accrueMetaMorphoRewardsForOneProgram(
      setupMetaMorpho(mmTx.metaMorpho),
      metaMorphoRewardsAccrual
    );
    metaMorphoRewards.save();

    // Then, we update the rewards for the given user.
    const positionRewards = accrueMetaMorphoPositionRewardsForOneProgram(
      metaMorphoRewards,
      position
    );
    positionRewards.save();
  }
}
