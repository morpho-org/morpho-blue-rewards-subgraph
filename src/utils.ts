import { Bytes, ethereum } from "@graphprotocol/graph-ts";

export namespace PositionType {
  export const SUPPLY = "SUPPLY";

  export const BORROW = "BORROW";

  export const COLLATERAL = "COLLATERAL";
}

export function generateLogId(event: ethereum.Event): Bytes {
  return event.transaction.hash;
}
