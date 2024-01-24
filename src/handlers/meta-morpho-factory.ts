import { BigInt } from "@graphprotocol/graph-ts";

import { CreateMetaMorpho as CreateMetaMorphoEvent } from "../../generated/MetaMorphoFactory/MetaMorphoFactory";
import { MetaMorpho as MetaMorphoEntity, User } from "../../generated/schema";
import { MetaMorpho as MetaMorphoTemplate } from "../../generated/templates";

export function handleCreateMetaMorpho(event: CreateMetaMorphoEvent): void {
  const mmEntity = new MetaMorphoEntity(event.params.metaMorpho);
  mmEntity.totalShares = BigInt.zero();
  mmEntity.save();

  const user = User.load(event.params.metaMorpho);

  if (user) {
    const rewardsProgramAccruals = user.rewardProgramAccruals.load();
    for (let i = 0; i < rewardsProgramAccruals.length; i++) {
      const rewardsProgramAccrual = rewardsProgramAccruals[i];
      rewardsProgramAccrual.metaMorpho = mmEntity.id;
      rewardsProgramAccrual.save();
    }
  }

  MetaMorphoTemplate.create(event.params.metaMorpho);
}
