const express = require('express');
const bodyParser = require('body-parser');
const cliProgress = require('cli-progress');
const { getCurrentBlock, getTransactionCountForAddress, getBalanceForAddress, getRandomAddressesFromBlocks } = require('./src/rpcHelper');
const { fetchBlockscoutTransactions, fetchScrollscanTransactions } = require('./src/fetchTransactions');
const { calculateSampleSize } = require('./src/statistics');
require('dotenv').config(); // Load environment variables

const retriesLimit = 6;
const app = express();
const port = process.env.PORT || 3000;
app.use(bodyParser.json());

// Helper function to implement delay
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Load environment variables for analysis parameters
const populationSize = parseInt(process.env.populationSize);
const confidenceLevel = parseInt(process.env.confidenceLevel);
const marginOfError = parseFloat(process.env.marginOfError);
const useBlockscout = process.env.USE_BLOCKSCOUT === 'true';

// Global variable to store the calculated percentiles
let blockchainPercentiles = {};

// Function to calculate percentiles for all analyzed wallets
const calculateAndStorePercentiles = (walletData) => {
    const metrics = ['transaction_count_rpc', 'balance', 'total_received', 'total_sent', 'total_fees', 'transaction_count_api', 'contract_interactions'];
    const percentiles = {};

    // Calculate the percentiles and store them in blockchainPercentiles
    metrics.forEach((metric) => {
        const metricValues = walletData.map(wallet => parseFloat(wallet[metric]));
        const sortedValues = metricValues.slice().sort((a, b) => a - b);
        percentiles[metric] = sortedValues;  // Store the sorted values
    });

    blockchainPercentiles = percentiles; // Store the percentiles globally

    // Print the percentiles in the console
    console.log("\nPercentiles calculated for the random wallets:");
    metrics.forEach((metric) => {
        console.log(`\nPercentiles for ${metric}:`);
        blockchainPercentiles[metric].forEach((value, index) => {
            const percentile = ((index + 1) / blockchainPercentiles[metric].length) * 100;
            console.log(`${percentile.toFixed(2)}%: ${value}`);
        });
    });
};

// Function to retry indefinitely if the API does not return results
const fetchTransactionDataWithRetries = async (address, retries = retriesLimit) => {
    let success = false;
    let transactionData;

    while (!success) {
        try {
            if (useBlockscout === true) {
                transactionData = await fetchBlockscoutTransactions(address);
            } else {
                transactionData = await fetchScrollscanTransactions(address);
            }

            if (transactionData.totalTxsAPI === 0) {
                console.log(`No API transactions found for ${address}. Retrying...`);
                await wait(2000);
            } else {
                success = true;
            }
        } catch (error) {
            console.log(`Error fetching transactions for ${address}. Retrying...`);
            await wait(2000);
        }
    }
    return transactionData;
};

// Analyze a single wallet and handle retries for both RPC and API
const analyzeWallet = async (address) => {
    try {
        const transactionCountRPC = await getTransactionCountForAddress(address);
        const balance = await getBalanceForAddress(address);

        if (transactionCountRPC === 0) {
            return {
                address,
                transaction_count_rpc: 0,
                balance: parseFloat(balance).toFixed(6),
                total_received: 0,
                total_sent: 0,
                total_fees: 0,
                transaction_count_api: 0,
                contract_interactions: 0
            };
        }

        const transactionData = await fetchTransactionDataWithRetries(address);
        const { totalTxsAPI, totalETHSent, totalETHReceived, totalFees, contractInteractions } = transactionData;

        return {
            address,
            transaction_count_rpc: transactionCountRPC,
            balance: parseFloat(balance).toFixed(6),
            total_received: parseFloat(totalETHReceived).toFixed(6),
            total_sent: parseFloat(totalETHSent).toFixed(6),
            total_fees: parseFloat(totalFees).toFixed(6),
            transaction_count_api: totalTxsAPI,
            contract_interactions: contractInteractions
        };
    } catch (error) {
        console.error(`Error analyzing wallet ${address}:`, error);
        return null;
    }
};

// Analyze all wallets and calculate the metrics and percentiles
const analyzeWallets = async () => {
    const sampleSize = calculateSampleSize(confidenceLevel, marginOfError, populationSize);
    console.log(`Sample Size to analyze: ${sampleSize}`);

    const currentBlock = await getCurrentBlock();
    if (!currentBlock) {
        console.error("Could not retrieve the current block number.");
        return;
    }
    console.log(`Current block number: ${currentBlock}`);

    const randomAddresses = await getRandomAddressesFromBlocks(currentBlock, sampleSize);
    console.log(`Selected ${randomAddresses.length} random addresses`);

    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(randomAddresses.length, 0);

    const analyzedWallets = [];
    for (const address of randomAddresses) {
        const walletData = await analyzeWallet(address);
        if (walletData) {
            analyzedWallets.push(walletData);
        }
        progressBar.increment();
    }

    progressBar.stop();

    console.log("Collected Wallet Data:", analyzedWallets);

    // Store the calculated percentiles and print them in the console
    calculateAndStorePercentiles(analyzedWallets);

    return analyzedWallets;
};

// Function to get the percentile of a wallet for a specific metric
const getPercentileForMetric = (value, sortedValues) => {
    const rank = sortedValues.filter(v => v <= value).length;
    const percentile = (rank / sortedValues.length) * 100;
    return percentile.toFixed(2);
};

// -- API INTEGRATION BELOW --

// Analyze and compare a specific wallet using blockchain data
const analyzeAndCompareWallet = async (address) => {
    const walletMetrics = await analyzeWallet(address);
    if (!walletMetrics) {
        return { error: `Could not analyze wallet ${address}` };
    }

    const comparisons = {};
    for (const metric of Object.keys(blockchainPercentiles)) {
        const metricValue = parseFloat(walletMetrics[metric]); // Ensure it's a float
        const percentile = getPercentileForMetric(metricValue, blockchainPercentiles[metric]);
        comparisons[metric] = {
            value: metricValue,
            percentile: percentile
        };
    }

    return {
        address,
        metrics: walletMetrics,
        comparisons
    };
};

// API endpoint to analyze a list of wallet addresses
app.post('/analyze-wallets', async (req, res) => {
    const { addresses } = req.body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
        return res.status(400).json({ error: 'Invalid input. Please provide an array of wallet addresses.' });
    }

    const results = [];
    for (const address of addresses) {
        const analysis = await analyzeAndCompareWallet(address);
        results.push(analysis);
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ results }, null, 2)); // Formatted JSON output
});

// Run the analysis of random wallets and calculate percentiles
const runAnalysis = async () => {
    const walletData = await analyzeWallets();

    if (walletData && walletData.length > 0) {
        console.log("Percentiles calculated and stored.");
    } else {
        console.error("No wallet data found to calculate percentiles.");
    }
};

// Load and run the initial analysis, then start the API
runAnalysis().then(() => {
    app.listen(port, () => {
        console.log(`API is running on port ${port}`);
    });
});
