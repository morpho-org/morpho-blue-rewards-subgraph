import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";

import { CurrentEpoch, Epoch, Market, MarketEpoch } from "../generated/schema";

import { INITIAL_INDEX } from "./constants";

export function getNextMarketEpoch(market: Market, ts: BigInt): MarketEpoch | null {
  let i: string = BigInt.fromI32(1).toString();
  while (true) {
    const epoch = Epoch.load(i);
    if (epoch == null) {
      return null;
    }
    const marketEpoch = MarketEpoch.load(market.id.toHexString() + "-" + i.toString());
    if (marketEpoch == null) {
      // No market epoch for this market, we can check the next one
      if (epoch.nextEpoch === null) return null;
      i = epoch.nextEpoch!;
    }
    if (epoch.start > ts) {
      return marketEpoch!;
    }
    if (epoch.nextEpoch === null) return null;
    i = epoch.nextEpoch!;
  }
}

function setupEpochs(): CurrentEpoch {
  let currentEpoch = new CurrentEpoch("1");
  currentEpoch.save();

  const marketA = Bytes.fromHexString("0x");
  const marketB = Bytes.fromHexString("0x");

  const epoch1 = new Epoch("1");
  epoch1.start = BigInt.fromI32(1);
  epoch1.end = BigInt.fromI32(1000);
  epoch1.totalDistributed = BigInt.fromI32(10).pow(18).times(BigInt.fromI32(10000));
  epoch1.rewardsAccrued = BigInt.zero();
  epoch1.save();

  const epoch2 = new Epoch("2");
  epoch2.start = BigInt.fromI32(1000);
  epoch2.end = BigInt.fromI32(2000);
  epoch2.totalDistributed = BigInt.fromI32(10).pow(18).times(BigInt.fromI32(10000));
  epoch2.rewardsAccrued = BigInt.zero();
  epoch2.previousEpoch = epoch1.id;
  epoch2.save();

  epoch1.nextEpoch = epoch2.id;
  epoch1.save();

  const epoch3 = new Epoch("3");
  epoch3.start = BigInt.fromI32(3000);
  epoch3.end = BigInt.fromI32(4000);
  epoch3.totalDistributed = BigInt.fromI32(10).pow(18).times(BigInt.fromI32(10000));
  epoch3.rewardsAccrued = BigInt.zero();
  epoch3.previousEpoch = epoch2.id;
  epoch3.save();

  epoch2.nextEpoch = epoch3.id;
  epoch2.save();

  // create rate for each market
  const marketAEpoch1 = new MarketEpoch(marketA.toHexString() + "-" + epoch1.id);
  marketAEpoch1.market = marketA;
  marketAEpoch1.epoch = epoch1.id;
  marketAEpoch1.rate = BigInt.fromI32(10).pow(18).times(BigInt.fromI32(5000)).div(BigInt.fromI32(999));
  marketAEpoch1.totalRewardsAccrued = BigInt.zero();
  marketAEpoch1.lastUpdateTimestamp = BigInt.zero();
  marketAEpoch1.rewardsSupplyIndex = INITIAL_INDEX;
  marketAEpoch1.save();

  const marketAEpoch2 = new MarketEpoch(marketA.toHexString() + "-" + epoch2.id);
  marketAEpoch2.market = marketA;
  marketAEpoch2.epoch = epoch2.id;
  marketAEpoch2.rate = BigInt.fromI32(10).pow(18).times(BigInt.fromI32(5000)).div(BigInt.fromI32(1000));
  marketAEpoch2.totalRewardsAccrued = BigInt.zero();
  marketAEpoch2.lastUpdateTimestamp = BigInt.zero();
  marketAEpoch2.rewardsSupplyIndex = INITIAL_INDEX;
  marketAEpoch2.save();

  const marketAEpoch3 = new MarketEpoch(marketA.toHexString() + "-" + epoch3.id);
  marketAEpoch3.market = marketA;
  marketAEpoch3.epoch = epoch3.id;
  marketAEpoch3.rate = BigInt.fromI32(10).pow(18).times(BigInt.fromI32(10000)).div(BigInt.fromI32(1000));
  marketAEpoch3.totalRewardsAccrued = BigInt.zero();
  marketAEpoch3.lastUpdateTimestamp = BigInt.zero();
  marketAEpoch3.rewardsSupplyIndex = INITIAL_INDEX;
  marketAEpoch3.save();

  const marketBEpoch1 = new MarketEpoch(marketB.toHexString() + "-" + epoch1.id);
  marketBEpoch1.market = marketB;
  marketBEpoch1.epoch = epoch1.id;
  marketBEpoch1.rate = BigInt.fromI32(10).pow(18).times(BigInt.fromI32(5000)).div(BigInt.fromI32(999));
  marketBEpoch1.totalRewardsAccrued = BigInt.zero();
  marketBEpoch1.lastUpdateTimestamp = BigInt.zero();
  marketBEpoch1.rewardsSupplyIndex = INITIAL_INDEX;
  marketBEpoch1.save();

  const marketBEpoch2 = new MarketEpoch(marketB.toHexString() + "-" + epoch2.id);
  marketBEpoch2.market = marketB;
  marketBEpoch2.epoch = epoch2.id;
  marketBEpoch2.rate = BigInt.fromI32(10).pow(18).times(BigInt.fromI32(5000)).div(BigInt.fromI32(1000));
  marketBEpoch2.totalRewardsAccrued = BigInt.zero();
  marketBEpoch2.lastUpdateTimestamp = BigInt.zero();
  marketBEpoch2.rewardsSupplyIndex = INITIAL_INDEX;
  marketBEpoch2.save();

  return currentEpoch;
}

export function getEpochFromTimestamp(ts: BigInt, epochFromId: string | null): Epoch | null {
  let id = epochFromId;
  if (id === null) {
    id = "1";
  }
  let epoch = Epoch.load(id);
  while (epoch !== null) {
    if (epoch.start <= ts && ts < epoch.end) {
      return epoch;
    }
    if (epoch.nextEpoch === null) {
      return null;
    }
    epoch = Epoch.load(epoch.nextEpoch as string);
  }
  return null;
}
export function syncEpochs(block: ethereum.Block): CurrentEpoch {
  let currentEpoch = CurrentEpoch.load("1");
  if (!currentEpoch) {
    currentEpoch = setupEpochs();
  }
  const _epoch = getEpochFromTimestamp(block.timestamp, currentEpoch.epoch);
  if (_epoch != null) {
    currentEpoch.epoch = _epoch.id;
  } else {
    currentEpoch.epoch = null;
  }
  currentEpoch.save();
  return currentEpoch;
}
