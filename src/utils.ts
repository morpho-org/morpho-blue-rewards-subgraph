import {BigInt} from "@graphprotocol/graph-ts";

export function minBI(a: BigInt, b: BigInt): BigInt {
    if(a.lt(b)) return a;
    return b;
}
export function maxBI(a: BigInt, b: BigInt): BigInt {
    if(a.gt(b)) return a;
    return b;
}