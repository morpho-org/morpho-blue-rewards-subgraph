# Morpho Blue Rewards Subgraph

## Overview
The Morpho Blue Rewards Subgraph is a specialized tool designed to index rewards accrued by users within the Morpho ecosystem. 
It targets the rewards programs that promise a rate through the [Rate Displayer](https://github.com/morpho-org/morpho-blue-rewards-emissions), offering a comprehensive view of the rewards dynamics across various Morpho markets.

## Features
This subgraph incorporates a range of features to support effective rewards tracking and computation:

- **Rewards Accrual**: It captures rewards accruing on the supply, borrow, and collateral aspects across all Morpho markets where rates have been promised.
- **Comprehensive Computation**: The subgraph calculates rewards for all MetaMorpho entities built on top of Morpho Blue, equipped to redistribute rewards.
- **Claims Accounting**: It efficiently accounts for claims on different [URDs (Universal Rewards Distributors)](https://github.com/morpho-org/universal-rewards-distributor) generated via the URD Factory.
- **Transaction Indexing**: The tool indexes all transactions related to Blue, MetaMorpho, and the Rate Displayer, enabling the possibility of recomputing the distribution from scratch, independent of the subgraph. It can allows any vault to distribute rewards, add a fee etc..

## Data Accuracy and Updates
Please note that the indexed data within the subgraph may not always be up-to-date. The information is refreshed following the latest market or user interaction, which means there could be a delay in reflecting the most current data.

## Upcoming Enhancements (Coming Soon)
To address the challenge of data currency, we are introducing an SDK that will enable real-time data, ensuring the availability of the most current rewards data. This SDK will be supplemented by an API, providing easy access to clear and understandable reward information for all users.

Stay tuned for these exciting updates to enhance your Morpho Rewards experience!
