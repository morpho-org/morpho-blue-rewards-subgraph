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

## MetaMorpho as collateral

In certain markets, it's possible to use a MetaMorpho token as collateral. We aim to distribute rewards to users who utilize the MetaMorpho token in this manner.

Here's our method for calculating rewards for users with MetaMorpho tokens as collateral:

- The MetaMorpho transfer handler omits transactions with `MM.transfer(from = Morpho)` or `MM.transfer(to = Morpho)`.
- During a `supplyCollateral`/`withdrawCollateral` operation, the handlers verify whether the collateral token is a MetaMorpho. If so, a transfer is initiated for the Morpho user:
    - For supplying collateral, it executes `MM.transfer(from=sender, to=onBehalf)`.
    - For withdrawing collateral, it executes `MM.transfer(from=onBehalf, to=receiver)`.

Therefore, in the overarching account ledger, a user's vault supply is calculated as the sum of the user's balance plus all of their vault collateral deposited as collateral on Morpho.

Note: Utilizing MetaMorpho as a loan asset is considered impractical due to the risk of share inflation vulnerability. Should this occur, the accounting will only apply to users who have made deposits.

We do not support this use case, and redistribution may be inaccurately executed, especially if transactions are made on behalf of another user, either for supply or withdrawal purposes.
