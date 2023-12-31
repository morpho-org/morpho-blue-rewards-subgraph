import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
} from "matchstick-as/assembly/index";

import { Address, Bytes } from "@graphprotocol/graph-ts";

import { handleRewardsEmissionSet } from "../src/handlers/emission-data-provider";

import { createRewardsEmissionSetEvent } from "./emission-data-provider-utils";

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let rewardToken = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    );
    let market = Bytes.fromI32(1234567890);
    let sender = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    );
    let urd = Address.fromString("0x0000000000000000000000000000000000000001");
    let rewardsEmission = "ethereum.Tuple Not implemented";
    let newRewardsEmissionSetEvent = createRewardsEmissionSetEvent(
      rewardToken,
      market,
      sender,
      urd,
      rewardsEmission
    );
    handleRewardsEmissionSet(newRewardsEmissionSetEvent);
  });

  afterAll(() => {
    clearStore();
  });

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("RewardsEmissionSet created and stored", () => {
    assert.entityCount("RewardsEmissionSet", 1);

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "RewardsEmissionSet",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "rewardToken",
      "0x0000000000000000000000000000000000000001"
    );
    assert.fieldEquals(
      "RewardsEmissionSet",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "market",
      "1234567890"
    );
    assert.fieldEquals(
      "RewardsEmissionSet",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "sender",
      "0x0000000000000000000000000000000000000001"
    );
    assert.fieldEquals(
      "RewardsEmissionSet",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "urd",
      "0x0000000000000000000000000000000000000001"
    );
    assert.fieldEquals(
      "RewardsEmissionSet",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "rewardsEmission",
      "ethereum.Tuple Not implemented"
    );

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  });
});
