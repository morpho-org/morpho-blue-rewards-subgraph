import { Bytes, crypto, ethereum } from "@graphprotocol/graph-ts";

export namespace PositionType {
  export const SUPPLY = "SUPPLY";

  export const BORROW = "BORROW";

  export const COLLATERAL = "COLLATERAL";
}

export function hashBytes(bytes: Bytes): Bytes {
  return Bytes.fromHexString(crypto.keccak256(bytes).toHexString());
}

export function generateLogId(event: ethereum.Event): Bytes {
  return hashBytes(
    event.transaction.hash.concat(
      Bytes.fromHexString(event.logIndex.toHexString())
    )
  );
}
