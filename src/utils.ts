import { Bytes, crypto, ethereum, log } from "@graphprotocol/graph-ts";

export namespace PositionType {
  export const SUPPLY = "SUPPLY";

  export const BORROW = "BORROW";

  export const COLLATERAL = "COLLATERAL";
}

export function hashBytes(bytes: Bytes): Bytes {
  return Bytes.fromHexString(crypto.keccak256(bytes).toHexString());
}

export function generateLogId(event: ethereum.Event): Bytes {
  // Pad to 32 bytes the log index
  const value = ethereum.Value.fromSignedBigInt(event.logIndex);

  const logIndex = ethereum.encode(value);
  if (!logIndex) {
    log.critical("Log index is null", []);
    return Bytes.fromUTF8("");
  }

  return hashBytes(event.transaction.hash.concat(logIndex));
}
