import { newMockEvent } from "matchstick-as"
import { ethereum, Address, Bytes } from "@graphprotocol/graph-ts"
import { RewardsEmissionSet } from "../generated/EmissionDataProvider/EmissionDataProvider"

export function createRewardsEmissionSetEvent(
  rewardToken: Address,
  market: Bytes,
  sender: Address,
  urd: Address,
  rewardsEmission: ethereum.Tuple
): RewardsEmissionSet {
  let rewardsEmissionSetEvent = changetype<RewardsEmissionSet>(newMockEvent())

  rewardsEmissionSetEvent.parameters = new Array()

  rewardsEmissionSetEvent.parameters.push(
    new ethereum.EventParam(
      "rewardToken",
      ethereum.Value.fromAddress(rewardToken)
    )
  )
  rewardsEmissionSetEvent.parameters.push(
    new ethereum.EventParam("market", ethereum.Value.fromFixedBytes(market))
  )
  rewardsEmissionSetEvent.parameters.push(
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender))
  )
  rewardsEmissionSetEvent.parameters.push(
    new ethereum.EventParam("urd", ethereum.Value.fromAddress(urd))
  )
  rewardsEmissionSetEvent.parameters.push(
    new ethereum.EventParam(
      "rewardsEmission",
      ethereum.Value.fromTuple(rewardsEmission)
    )
  )

  return rewardsEmissionSetEvent
}
