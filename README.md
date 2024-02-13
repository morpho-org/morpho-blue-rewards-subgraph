# Morpho Blue Rewards Subgraph

## Overview
The Morpho Blue Rewards Subgraph serves as a dedicated indexing tool to track rewards accrued by users of Morpho Blue's ecosystem. It focuses on indexing rewards from programs offering specified rates through the [Rate Displayer](https://github.com/morpho-org/morpho-blue-rewards-emissions), giving insights into rewards dynamics across different Morpho markets.

## Features
The subgraph offers several features aimed at enhancing rewards tracking and management:

- **Rewards Accrual Tracking**: It monitors rewards accumulating in supply, borrow, and collateral segments across all Morpho markets with defined rates.
- **Comprehensive Rewards Computation**: Designed to calculate rewards for MetaMorpho entities atop Morpho Blue, facilitating efficient rewards redistribution.
- **Claims Management**: Efficiently manages claims through various [Universal Rewards Distributors (URDs)](https://github.com/morpho-org/universal-rewards-distributor) created via the URD Factory.
- **Transaction Indexing**: Indexes transactions related to Blue, MetaMorpho, and the Rate Displayer, allowing for the possibility of independent reward distribution recomputation, including the addition of fees or other modifications by any vault owner.

## Data Accuracy and Updates
Indexed data within the subgraph may experience updates delays, pending the latest market or user interactions. This delay might affect the immediacy of data reflection.

## Upcoming Enhancements (Coming Soon)
We are developing an SDK to facilitate real-time data updates, aiming to ensure immediate access to the latest rewards information. This SDK will be complemented by an API, simplifying access to reward data for all users. More details on these enhancements will be provided soon.

## Precision
To distribute rewards accurately, a rewards index with `p` decimals of precision is defined for each market. The value of `p` depends on the side of the market on which rewards are distributed:

- `p = 36 + rewardTokenDecimals - (loanTokenDecimals + 6)` for supply/borrow
- `p = 36 + rewardTokenDecimals - collateralTokenDecimals` for collateral
