import { BigInt, log } from "@graphprotocol/graph-ts";

import {
  MetaMorphoPosition,
  MetaMorphoPositionRewards,
  MetaMorphoRewardsAccrual,
  MetaMorphoTx,
  UserRewardProgramAccrual,
} from "../generated/schema";

import { RAY } from "./constants";
import { distributeMarketRewards } from "./distribute-market-rewards";
import {
  getOrInitMetaMorphoPositionRewards,
  getOrInitMetaMorphoRewardsAccrual,
  setupMetaMorpho,
  setupMetaMorphoPosition,
  setupUser,
} from "./initializers";

function accrueMetaMorphoRewardsForOneProgram(
  mmBlueRewardsAccrual: UserRewardProgramAccrual
): MetaMorphoRewardsAccrual {
  const mm = setupMetaMorpho(mmBlueRewardsAccrual.metaMorpho!);

  const mmRewardsAccrual = getOrInitMetaMorphoRewardsAccrual(
    mmBlueRewardsAccrual.metaMorpho!,
    mmBlueRewardsAccrual.rewardProgram
  );

  const rewardsAccrued = mmBlueRewardsAccrual.supplyRewardsAccrued;
  if (mm.totalShares.gt(BigInt.zero())) {
    mmRewardsAccrual.lastSupplyIndex = mmRewardsAccrual.lastSupplyIndex.plus(
      rewardsAccrued.times(RAY).div(mm.totalShares)
    );
  }

  // if shares are zero and supply rewards not to zero, its due to a donation, and we do not redistribute them.
  if (
    mm.totalShares.isZero() &&
    mmBlueRewardsAccrual.supplyRewardsAccrued.gt(BigInt.zero())
  ) {
    log.warning(
      "Donation detected for metamorpho {}, {} rewards not redistributed",
      [
        mm.id.toHexString(),
        mmBlueRewardsAccrual.supplyRewardsAccrued.toHexString(),
      ]
    );
  }
  mmBlueRewardsAccrual.supplyRewardsAccrued = BigInt.zero();
  mmBlueRewardsAccrual.save();

  mmRewardsAccrual.save();
  return mmRewardsAccrual;
}

function accrueMetaMorphoPositionRewardsForOneProgram(
  mmRewardsAccrual: MetaMorphoRewardsAccrual,
  mmPosition: MetaMorphoPosition
): MetaMorphoPositionRewards {
  let mmPositionRewards = getOrInitMetaMorphoPositionRewards(
    mmRewardsAccrual.id,
    mmPosition.id
  );

  const userAccrued = mmRewardsAccrual.lastSupplyIndex
    .minus(mmPositionRewards.lastIndex)
    .times(mmPosition.shares)
    .div(RAY);

  mmPositionRewards.rewardsAccrued =
    mmPositionRewards.rewardsAccrued.plus(userAccrued);

  mmPositionRewards.lastIndex = mmRewardsAccrual.lastSupplyIndex;

  mmPositionRewards.save();

  return mmPositionRewards;
}

export function distributeMetaMorphoRewards(mmTx: MetaMorphoTx): void {
  // First, we need to accrue the rewards, per RewardProgram, for the vault on the different markets.

  let metaMorphoAsBlueUser = setupUser(mmTx.metaMorpho);

  const bluePositions = metaMorphoAsBlueUser.positions.load();

  for (let i = 0; i < bluePositions.length; i++) {
    const bluePosition = bluePositions[i];
    distributeMarketRewards(
      bluePosition.market,
      bluePosition.user,
      mmTx.timestamp
    );
  }

  // Refresh entity
  metaMorphoAsBlueUser = setupUser(mmTx.metaMorpho);

  const metaMorphoRewardsAccruals =
    metaMorphoAsBlueUser.rewardProgramAccruals.load();

  const position = setupMetaMorphoPosition(mmTx.user, mmTx.metaMorpho);

  // Then, we need to accrue the rewards for the vault, per RewardProgram, for the given user.
  for (let i = 0; i < metaMorphoRewardsAccruals.length; i++) {
    const mmBlueRewardsAccrual = metaMorphoRewardsAccruals[i];

    // first, we need to accrue the rewards for the metamorpho vault
    const metaMorphoRewardsAccrual =
      accrueMetaMorphoRewardsForOneProgram(mmBlueRewardsAccrual);

    // Then, we update the rewards for the given user.
    accrueMetaMorphoPositionRewardsForOneProgram(
      metaMorphoRewardsAccrual,
      position
    );
  }

  // shares are negative for withdrawals
  position.shares = position.shares.plus(mmTx.shares);
  position.save();

  const metaMorpho = setupMetaMorpho(mmTx.metaMorpho);
  metaMorpho.totalShares = metaMorpho.totalShares.plus(mmTx.shares);
  metaMorpho.save();
}
