const axios = require('axios');
require('dotenv').config();

// Fetch current block number using RPC
const getCurrentBlock = async () => {
    try {
        const response = await axios.post(process.env.RPC_URL, {
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: [],
            id: 1
        });
        return parseInt(response.data.result, 16);
    } catch (error) {
        console.error("Error fetching the current block:", error.message);
        return null;
    }
};

// Fetch the transaction count for a specific address
const getTransactionCountForAddress = async (address, retries = 3) => {
    try {
        const response = await axios.post(process.env.RPC_URL, {
            jsonrpc: "2.0",
            method: "eth_getTransactionCount",
            params: [address, "latest"],
            id: 1
        });
        return parseInt(response.data.result, 16);
    } catch (error) {
        if (retries > 0) {
            console.log(`Retrying transaction count for address ${address}, retries left: ${retries}. Error: ${error.message}`);
            return await getTransactionCountForAddress(address, retries - 1);
        } else {
            console.error(`Failed to fetch transaction count for address ${address}:`, error.message);
            return null;
        }
    }
};

// Fetch the balance for a specific address
const getBalanceForAddress = async (address, retries = 3) => {
    try {
        const response = await axios.post(process.env.RPC_URL, {
            jsonrpc: "2.0",
            method: "eth_getBalance",
            params: [address, "latest"],
            id: 1
        });
        return parseFloat(parseInt(response.data.result, 16) / 10 ** 18).toFixed(4); // Convert from wei to ETH
    } catch (error) {
        if (retries > 0) {
            console.log(`Retrying balance for address ${address}, retries left: ${retries}. Error: ${error.message}`);
            return await getBalanceForAddress(address, retries - 1);
        } else {
            console.error(`Failed to fetch balance for address ${address}:`, error.message);
            return null;
        }
    }
};

// Fetch the number of transactions in a specific block
const getTransactionCountInBlock = async (blockNumber, retries = 3) => {
    try {
        const response = await axios.post(process.env.RPC_URL, {
            jsonrpc: "2.0",
            method: "eth_getBlockByNumber",
            params: [blockNumber, false], // `false` means we don’t fetch full transaction objects
            id: 1
        });

        const blockData = response.data.result;
        if (!blockData || !blockData.transactions) {
            throw new Error(`Block data is incomplete for block ${blockNumber}`);
        }
        return blockData.transactions.length;
    } catch (error) {
        if (retries > 0) {
            console.log(`Retrying block transaction count fetch for block ${blockNumber}, retries left: ${retries}. Error: ${error.message}`);
            return await getTransactionCountInBlock(blockNumber, retries - 1);
        } else {
            console.error(`Failed to fetch transaction count for block ${blockNumber}:`, error.message);
            return null;
        }
    }
};

// Fetch a random transaction by block number and index
const getTransactionByBlockAndIndex = async (blockNumber, transactionIndex, retries = 3) => {
    try {
        const response = await axios.post(process.env.RPC_URL, {
            jsonrpc: "2.0",
            method: "eth_getTransactionByBlockNumberAndIndex",
            params: [blockNumber, transactionIndex],
            id: 1
        });
        return response.data.result; // The transaction object
    } catch (error) {
        if (retries > 0) {
            console.log(`Retrying transaction fetch for block ${blockNumber}, index ${transactionIndex}, retries left: ${retries}. Error: ${error.message}`);
            return await getTransactionByBlockAndIndex(blockNumber, transactionIndex, retries - 1);
        } else {
            console.error(`Failed to fetch transaction for block ${blockNumber}, index ${transactionIndex}:`, error.message);
            return null;
        }
    }
};

// Get a random transaction address from a block
const getRandomTransactionAddress = async (blockNumber, retries = 3) => {
    const transactionCount = await getTransactionCountInBlock(blockNumber);
    if (transactionCount === 0) {
        console.warn(`No transactions found in block ${blockNumber}`);
        return null;
    }

    // Pick a random transaction index
    const randomIndex = Math.floor(Math.random() * transactionCount);
    const transaction = await getTransactionByBlockAndIndex(blockNumber, `0x${randomIndex.toString(16)}`);

    if (transaction && transaction.from) {
        return transaction.from;
    } else {
        console.warn(`No valid transaction found at block ${blockNumber}, index ${randomIndex}`);
        return null;
    }
};

// Get random addresses from random blocks
const getRandomAddressesFromBlocks = async (currentBlock, sampleSize) => {
    const randomAddresses = [];
    while (randomAddresses.length < sampleSize) {
        const randomBlockNumber = `0x${Math.floor(Math.random() * currentBlock).toString(16)}`;
        const address = await getRandomTransactionAddress(randomBlockNumber);
        if (address) {
            randomAddresses.push(address);
        }
    }
    return randomAddresses;
};

module.exports = {
    getCurrentBlock,
    getRandomAddressesFromBlocks,    
    getTransactionCountForAddress,
    getBalanceForAddress,
};
