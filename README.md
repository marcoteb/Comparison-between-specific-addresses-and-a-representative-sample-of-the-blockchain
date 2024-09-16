# Ethereum Wallet Analyzer

Ethereum Wallet Analyzer is a professional-grade Node.js application that analyzes Ethereum wallets by gathering essential metrics such as transaction count, balance, ETH sent/received, fees, and interactions with smart contracts. The application performs data collection using Ethereum RPC nodes and Scan APIs (e.g., Etherscan), providing statistical insights, including percentile rankings for each metric. This tool is ideal for blockchain developers, data analysts, and institutions interested in deep wallet behavior analysis on the Ethereum network.

## Key Features

- **Blockchain Data Collection**: Collects key wallet metrics using Ethereum RPC and external API services like Etherscan.
- **Advanced Metrics**:
  - **Transaction Count (RPC)**: Total number of transactions detected via the Ethereum node.
  - **Balance**: Current wallet balance in ETH.
  - **Total ETH Sent/Received**: Aggregate ETH sent and received by each wallet.
  - **Total Fees**: Cumulative transaction fees paid by the wallet.
  - **Contract Interactions**: Number of interactions with smart contracts.
- **Percentile Calculations**: Calculates and ranks each wallet's metrics relative to other analyzed wallets, providing percentile insights.
- **Resilience and Retry Logic**: Implements robust retry mechanisms to handle API rate limits and errors, ensuring complete data retrieval.
- **REST API Endpoint**: Provides a flexible API endpoint for analyzing and comparing Ethereum wallet metrics in real-time.

## System Requirements

Before running the project, ensure the following dependencies are installed:

- **Node.js** (v16.x or higher)
- **npm** (comes with Node.js)
- **Git** (to clone the repository)
- **Docker** (optional for containerized deployment)

## Setup and Installation

Follow these steps to set up and run the application locally or in a Docker container:

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/wallet-analyzer.git
cd wallet-analyzer
```

### 2. Install Dependencies

Run the following command to install all required Node.js dependencies:

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the project root directory. Define the following environment variables:

```bash
BLOCKSCOUT_API=//your-blockscout-api
SCROLLSCAN_API=//your-scan-api
RPC_URL=https://your-ethereum-rpc-url
SCAN_API=https://api.etherscan.io/api
API_KEY_SCROLL=your-etherscan-api-key
PORT=3000
populationSize=1000000
confidenceLevel=95
marginOfError=0.05
USE_BLOCKSCOUT=true
```

- `BLOCKSCOUT_API`:Blockscout api URL
- `RPC_URL`: The Ethereum node RPC endpoint.
- `SCROLLSCAN_API`: The base URL for the Scan API (e.g., Etherscan).
- `SCAN_API_KEY`: Your Scan API key.
- `PORT`: The port on which the server will run.
- `populationSize`: Estimated total number of active Ethereum addresses.
- `confidenceLevel`: Confidence level for statistical sampling (e.g., 95%).
- `marginOfError`: Margin of error for sample size calculation (e.g., 0.05).
- `USE_BLOCKSCOUT`: Flag to indicate whether to use Blockscout APIs (set to `true`).

### 4. Running the Application

#### Local Development

To start the application locally, run:

```bash
npm start
```

The server will be available on the port specified in the `.env` file (default is `3000`).

#### Docker Deployment

Alternatively, you can run the application inside a Docker container:

1. **Build the Docker Image**:

    ```bash
    docker build -t wallet-analyzer .
    ```

2. **Run the Docker Container**:

    ```bash
    docker run -p 3000:3000 --env-file .env wallet-analyzer
    ```

## API Usage

The application exposes a REST API for analyzing wallets. You can send a POST request to the `/analyze-wallets` endpoint with a list of Ethereum wallet addresses.

### Example API Request

```bash
curl -X POST http://localhost:3000/analyze-wallets \
-H "Content-Type: application/json" \
-d '{
    "addresses": ["0x1234567890abcdef1234567890abcdef12345678", "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"]
}'
```

### Example API Response

```json
{
  "results": [
    {
      "address": "0x1234567890abcdef1234567890abcdef12345678",
      "metrics": {
        "transaction_count_rpc": 10,
        "balance": "0.100000",
        "total_received": "1.000000",
        "total_sent": "0.900000",
        "total_fees": "0.010000",
        "transaction_count_api": 12,
        "contract_interactions": 3
      },
      "comparisons": {
        "transaction_count_rpc": {
          "value": 10,
          "percentile": "50.00"
        },
        "balance": {
          "value": "0.100000",
          "percentile": "60.00"
        },
        "total_received": {
          "value": "1.000000",
          "percentile": "70.00"
        },
        "total_sent": {
          "value": "0.900000",
          "percentile": "65.00"
        },
        "total_fees": {
          "value": "0.010000",
          "percentile": "75.00"
        },
        "transaction_count_api": {
          "value": 12,
          "percentile": "80.00"
        },
        "contract_interactions": {
          "value": 3,
          "percentile": "55.00"
        }
      }
    }
  ]
}
```

## How It Works

### 1. **Random Address Sampling**

The application calculates the sample size based on the population size, confidence level, and margin of error provided in the environment variables. It then fetches the current block number and randomly selects Ethereum wallet addresses from recent blocks using the Ethereum RPC.

### 2. **Data Collection**

For each selected address, the application gathers data using two mechanisms:

- **RPC Calls**: The application fetches the transaction count and balance of the address directly from the Ethereum node.
- **Scan API**: The application retrieves detailed transaction data such as total ETH sent, received, fees paid, and interactions with smart contracts.

### 3. **Retry Logic**

The application implements exponential backoff retry logic for both RPC and API calls to handle rate limits or temporary network issues. If an address has transactions according to the RPC but none according to the API, the application will retry the API request up to six times before failing gracefully.

### 4. **Percentile Calculation**

Once the wallet metrics are collected, the application calculates the percentile for each metric across all sampled wallets, allowing users to compare individual wallet behavior relative to the broader Ethereum network.

### 5. **REST API**

The application exposes an API endpoint that allows users to submit a list of Ethereum wallet addresses and compare their metrics against the analyzed sample. This comparison includes percentile ranks for metrics such as transaction count, balance, and contract interactions.

## Project Structure

```
project-directory/
│   .env                         # Environment variables
│   Dockerfile                   # Docker container configuration
│   package.json                 # Project metadata and dependencies
│   app.js                       # Main application logic
└───src/
    │   fetchTransactions.js      # Functions for fetching transaction data from APIs
    │   calculatePercentile.js    # Percentile calculation functions
    │   rpcHelper.js              # Functions for Ethereum RPC calls
    │   statistics.js             # Sample size calculation logic
    │   analyzeWallets.js         # Core wallet analysis functions
```

### Key Files

- **app.js**: The main entry point of the application, which initializes the API server and manages the analysis process for Ethereum wallets.
- **rpcHelper.js**: Provides RPC functions for interacting with the Ethereum blockchain, including fetching block numbers, wallet balances, and transaction counts.
- **fetchTransactions.js**: Fetches transaction data using APIs such as Etherscan or Blockscout, processing transaction metrics like total ETH sent, received, and contract interactions.
- **calculatePercentile.js**: Contains logic for calculating percentiles based on the collected wallet metrics.
- **statistics.js**: Provides sample size calculation logic based on population size, margin of error, and confidence level.


