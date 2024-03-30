import { Address, BigInt } from "@graphprotocol/graph-ts";

export const ONE_YEAR = BigInt.fromString("31536000");
export const PRECISION = BigInt.fromString("10").pow(36 as u8);

export const MORPHO_ADDRESS = Address.fromString(
  "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"
);
