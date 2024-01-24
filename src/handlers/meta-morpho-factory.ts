import { BigInt } from "@graphprotocol/graph-ts";

import { MetaMorpho as MetaMorphoContract } from "../../generated/MetaMorpho/MetaMorpho";
import { ERC20 } from "../../generated/MetaMorphoFactory/ERC20";
import { CreateMetaMorpho as CreateMetaMorphoEvent } from "../../generated/MetaMorphoFactory/MetaMorphoFactory";
import { MetaMorpho as MetaMorphoEntity, User } from "../../generated/schema";
import { MetaMorpho as MetaMorphoTemplate } from "../../generated/templates";

export function handleCreateMetaMorpho(event: CreateMetaMorphoEvent): void {
  const mmEntity = new MetaMorphoEntity(event.params.metaMorpho);
  mmEntity.totalShares = BigInt.zero();

  const mmContract = MetaMorphoContract.bind(event.params.metaMorpho);
  const underlying = ERC20.bind(mmContract.asset());

  const tryDecimals = underlying.try_decimals();
  if (!tryDecimals.reverted) {
    mmEntity.underlyingDecimals = BigInt.fromI32(tryDecimals.value);
  } else {
    // this is the computation done in the OZ ERC4626 contract
    mmEntity.underlyingDecimals = BigInt.fromI32(18);
  }
  mmEntity.save();

  const user = User.load(event.params.metaMorpho);

  if (user) {
    const rewardsProgramAccruals = user.rewardProgramAccruals.load();
    for (let i = 0; i < rewardsProgramAccruals.length; i++) {
      const rewardsProgramAccrual = rewardsProgramAccruals[i];
      rewardsProgramAccrual.metamorpho = mmEntity.id;
      rewardsProgramAccrual.save();
    }
  }

  MetaMorphoTemplate.create(event.params.metaMorpho);
}
