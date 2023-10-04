import { Bytes } from "@graphprotocol/graph-ts";

const whitelistedMarkets = new Map<Bytes, boolean>();
whitelistedMarkets.set(Bytes.fromHexString("0x"), true);

export function isRewardedMarket(marketId: Bytes): boolean {
  return !!whitelistedMarkets.has(marketId) && whitelistedMarkets.get(marketId);
}
