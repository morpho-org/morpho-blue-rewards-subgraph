import {BigInt, Bytes, ethereum, log} from "@graphprotocol/graph-ts";
import {CurrentEpoch, Epoch, Market, MarketEpoch} from "../generated/schema";
import {INITIAL_INDEX, SHARES_OFFSET} from "./constants";
import {maxBI, minBI} from "./utils";
import {getNextMarketEpoch} from "./syncEpochs";


/**
 * Accrue the rewards for one market epoch, for the time between tsFrom and tsTo.
 */
export function accrueOneEpochRewards(market: Market, marketEpoch: MarketEpoch, tsFrom: BigInt, tsTo: BigInt, situation: string): void {
    const epoch = Epoch.load(marketEpoch.epoch.toString());
    if (epoch == null) {
        log.critical("{}: Epoch not found: {}", [situation, marketEpoch.epoch.toString()]);
        return;
    }
    const to = minBI(epoch.end, tsTo);
    const deltaTs = to.minus(maxBI(epoch.start, tsFrom))
    if (deltaTs.lt(BigInt.zero())) {
        log.critical("{}: deltaTs is negative, this should never happen", [situation]);
    }
    const accrued = marketEpoch.rate.times(deltaTs);
    marketEpoch.totalRewardsAccrued = marketEpoch.totalRewardsAccrued.plus(accrued);
    market.rewardsAccrued = market.rewardsAccrued.plus(accrued);
    marketEpoch.rewardsSupplyIndex = marketEpoch.rewardsSupplyIndex.plus(accrued.times(SHARES_OFFSET).div(market.supplyShares));
    marketEpoch.lastUpdateTimestamp = to;
    marketEpoch.save();
    market.save();
}


/**
 * Handle the full epochs between marketEpochFrom and marketEpochTo, excluded.
 */
export function handleFullEpochs(market: Market, marketEpochFrom: MarketEpoch, marketEpochTo: MarketEpoch | null, situation: string): void {
    if (marketEpochFrom.market !== market.id) {
        log.critical("{}: Market epoch from is not for the market: {}", [situation, market.id.toHexString()]);
        return;
    }
    if (marketEpochTo !== null && marketEpochTo.market !== market.id) {
        log.critical("{}: Market epoch to is not for the market: {}", [situation, market.id.toHexString()]);
        return;
    }

    let totalAccrued = BigInt.zero();

    let marketEpochToHandle: MarketEpoch | null = marketEpochFrom;
    while (marketEpochToHandle !== marketEpochTo) {
        // we pass the full epoch
        if (marketEpochToHandle === null) {
            // the prev epochs cannot be null if the last one is not null
            log.critical("{}: Epoch to handle is null, this should never happen", [situation]);
            return;
        }
        if (!marketEpochToHandle.totalRewardsAccrued.isZero() || !marketEpochToHandle.rewardsSupplyIndex.equals(INITIAL_INDEX)) {
            log.critical("{}: Epoch to handle is not empty, this should never happen", [situation]);
            return;
        }
        const epoch = Epoch.load(marketEpochToHandle.epoch.toString());
        if (epoch == null) {
            log.critical("{}: Epoch not found: {}", [situation, marketEpochToHandle.epoch.toString()]);
            return;
        }
        accrueOneEpochRewards(market, marketEpochToHandle, epoch.start, epoch.end, situation);

        marketEpochToHandle = getNextMarketEpoch(market, epoch.end);
    }
    market.rewardsAccrued = market.rewardsAccrued.plus(totalAccrued);
    market.save();
}

export function accrueMarketRewards(
    marketId: Bytes,
    block: ethereum.Block
): Market {

    const market = Market.load(marketId);
    if (market == null) {
        log.critical("Market not found: {}", [marketId.toHexString()]);
        return new Market(marketId);
    }

    const epochPointer = CurrentEpoch.load("1");

    if (epochPointer == null) {
        log.critical("Current epoch not found", [])
        return market;
    }

    let currentMarketEpoch: MarketEpoch | null = null;
    if (epochPointer.epoch !== null) {
        currentMarketEpoch = MarketEpoch.load(marketId.toHexString() + "-" + epochPointer.epoch.toString());
    }

    if (currentMarketEpoch === null) {
        if (market.lastEpoch === null) {

            const nextMarketEpoch = getNextMarketEpoch(market, block.timestamp)
            const nextMarketEpochOfLastUpdate = getNextMarketEpoch(market, market.lastCheckTimestamp)
            if (nextMarketEpoch === nextMarketEpochOfLastUpdate) {
                // Situation 1:

                // MC     1      2     E1                    /E1                   E2                   /E2
                // |......|......|.....|---------------------|.....................|--------------------|...............
                // 1: The last market check
                // 2: the current timestamp
                // There is no epoch to handle in this situation, we can directly return
                // The particularity is that getNextEpoch for the 2 timestamps will return the same epoch.
                market.lastCheckTimestamp = block.timestamp;
                market.save();
                // If they are both equal to null, it means that there is no epoch for this market.
                return market;
            } else {
                // Situation 2:
                // MC     1            E1                    /E1       2           E2                   /E2

                // |......|............|---------------------|.........|...........|--------------------|...............
                // 1: The last market check
                // 2: the current timestamp
                // There is only full epochs to handle in this situation.
                const situation = "Situation 2"
                if (nextMarketEpochOfLastUpdate === null) {
                    log.critical("{}: Next market epoch of last update is null, this should never happen", [situation]);
                    return market;
                }
                handleFullEpochs(market, nextMarketEpochOfLastUpdate, nextMarketEpoch, situation)

                // market.lastEpoch is already null
                market.lastCheckTimestamp = block.timestamp;
                market.save();
                return market;
            }
        } else { // market.lastEpoch !== null

            // Situation 3:

            // MC                  E1               1    /E1           2       E2                   /E2
            // |...................|----------------|----|.............|.......|--------------------|...............
            // 1: The last market check
            // 2: the current timestamp
            // There is one epoch to finish in this situation
            const marketEpoch = MarketEpoch.load(market.lastEpoch);
            if (marketEpoch == null) {
                log.critical("Situation 3: Market epoch not found: {}", [market.lastEpoch]);
                return market;
            }
            const epoch = Epoch.load(marketEpoch.epoch.toString());
            if (epoch == null) {
                log.critical("Situation 3: Epoch not found: {}", [marketEpoch.epoch.toString()]);
                return market;
            }
            accrueOneEpochRewards(market, marketEpoch, marketEpoch.lastUpdateTimestamp, epoch.end, "Situation 3")

            const followingMarketEpoch = getNextMarketEpoch(market, epoch.end);
            const nextMarketEpoch = getNextMarketEpoch(market, block.timestamp);
            if (followingMarketEpoch !== null && nextMarketEpoch?.id !== followingMarketEpoch.id) {

                // Situation 4:

                // MC                  E1               1    /E1                  E2                   /E2       2
                // |...................|----------------|----|....................|--------------------|.........|......
                // 1: The last market check
                // 2: the current timestamp
                // There is one epoch to finish in this situation, and other epochs to fully handle.

                // Here we already have handled the started epoch, we just have to handle full epochs.
                handleFullEpochs(market, followingMarketEpoch, nextMarketEpoch, "Situation 4");
            }
            market.lastCheckTimestamp = block.timestamp;
            market.lastEpoch = null;
            market.save();

        }
        return market;
    }

    // currentMarketEpoch !== null
    if (market.lastEpoch === null) {
        // Situation 5:

        // MC         1        E1                   /E1                  E2         2         /E2
        // |..........|........|--------------------|....................|----------|---------|...............
        // 1: The last market check
        // 2: the current timestamp
        // There is one epoch to start in this situation.

        const nextMarketEpoch = getNextMarketEpoch(market, market.lastCheckTimestamp);
        if (nextMarketEpoch === null) {
            log.critical("Situation 5: Next market epoch is null, this should never happen", []);
            return market;
        }
        handleFullEpochs(market, nextMarketEpoch, currentMarketEpoch, "Situation 5");

        // Then, we have to handle the current epoch
        // handleFullEpochs returns directly if there is no epoch to fullfill in the middle.
        const epoch = Epoch.load(currentMarketEpoch.epoch.toString());
        if (epoch == null) {
            log.critical("Situation 5: Epoch not found: {}", [currentMarketEpoch.epoch.toString()]);
            return market;
        }
        accrueOneEpochRewards(market, currentMarketEpoch, epoch.start, block.timestamp, "Situation 5");
        market.lastCheckTimestamp = block.timestamp;
        market.lastEpoch = currentMarketEpoch.id;
        market.save();
        return market;
    }

    // market.lastEpoch !== null
    // currentMarketEpoch !== null

    const lastMarketEpoch = MarketEpoch.load(market.lastEpoch);
    if (lastMarketEpoch == null) {
        log.critical("Situation 6: Market epoch not found: {}", [market.lastEpoch]);
        return market;
    }
    if (currentMarketEpoch.id === lastMarketEpoch.id) {

        // Situation 6:
        // MC                 E1    1        2      /E1                   E2                  /E2
        // |..................|-----|--------|-------|....................|-------------------|...............
        // 1: The last market check
        // 2: the current timestamp
        // We are in the same epoch
        accrueOneEpochRewards(market, lastMarketEpoch, lastMarketEpoch.lastUpdateTimestamp, block.timestamp, "Situation 6")
        market.lastCheckTimestamp = block.timestamp;
        market.save();
        return market;
    } else {
        // Situation 7:
        // MC                 E1    1              /E1                   E2         2        /E2
        // |..................|-----|---------------|....................|----------|--------|...............
        // 1: The last market check
        // 2: the current timestamp
        // We are in the same epoch
        // We first have to finish the last epoch, then handling full epochs and start the current epoch
        const lastEpoch = Epoch.load(lastMarketEpoch.epoch.toString());
        if (lastEpoch == null) {
            log.critical("Situation 7: Epoch not found: {}", [lastMarketEpoch.epoch.toString()]);
            return market;
        }
        accrueOneEpochRewards(market, lastMarketEpoch, lastMarketEpoch.lastUpdateTimestamp, lastEpoch.end, "Situation 7")

        // Then, we have to handle the full epochs
        const nextMarketEpoch = getNextMarketEpoch(market, lastEpoch.end);
        if (nextMarketEpoch === null) {
            log.critical("Situation 7: Next market epoch is null, this should never happen", []);
            return market;
        }
        handleFullEpochs(market, nextMarketEpoch, currentMarketEpoch, "Situation 7");

        // Then, we have to handle the current epoch
        const epoch = Epoch.load(currentMarketEpoch.epoch.toString());
        if (epoch == null) {
            log.critical("Situation 7: Epoch not found: {}", [currentMarketEpoch.epoch.toString()]);
            return market;
        }
        accrueOneEpochRewards(market, currentMarketEpoch, epoch.start, block.timestamp, "Situation 7");

        market.lastCheckTimestamp = block.timestamp;
        market.lastEpoch = currentMarketEpoch.id;
        market.save();
    }
    return market;
}