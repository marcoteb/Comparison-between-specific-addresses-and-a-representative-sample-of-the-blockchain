const axios = require('axios');
require('dotenv').config();

// Helper function to implement exponential backoff
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch transaction data from Blockscout with pagination support
const fetchBlockscoutTransactions = async (address, delay = 10000, next_page_params = null) => {
    let url = `${process.env.BLOCKSCOUT_API}/addresses/${address}/transactions?filter=to%20%7C%20from`;
    if (next_page_params) {
        url += `&block_number=${next_page_params.block_number}&index=${next_page_params.index}`;
    }

    try {
        console.log(`Fetching Blockscout transactions for ${address} from: ${url}`);
        const response = await axios.get(url);
        const transactions = response.data.items;

        if (!transactions || transactions.length === 0) {
            throw new Error('No transactions found');
        }

        let totalETHSent = 0;
        let totalETHReceived = 0;
        let totalFees = 0;
        let contractInteractions = 0;

        // Process transactions
        for (const tx of transactions) {
            if (tx.from && tx.from.hash && tx.from.hash.toLowerCase() === address.toLowerCase()) {
                totalETHSent += parseFloat(tx.value) / 10 ** 18;
                totalFees += parseFloat(tx.fee.value) / 10 ** 18;
            } else if (tx.to && tx.to.hash && tx.to.hash.toLowerCase() === address.toLowerCase()) {
                totalETHReceived += parseFloat(tx.value) / 10 ** 18;
            }

            if (tx.to && tx.to.is_contract) {
                contractInteractions++;
            }
        }

        // If there are more pages, continue recursively
        if (response.data.next_page_params) {
            const nextPageData = await fetchBlockscoutTransactions(address, delay, response.data.next_page_params);
            totalETHSent += parseFloat(nextPageData.totalETHSent);
            totalETHReceived += parseFloat(nextPageData.totalETHReceived);
            totalFees += parseFloat(nextPageData.totalFees);
            contractInteractions += nextPageData.contractInteractions;
            return {
                totalTxsAPI: transactions.length + nextPageData.totalTxsAPI,
                totalETHSent: totalETHSent.toFixed(6),
                totalETHReceived: totalETHReceived.toFixed(6),
                totalFees: totalFees.toFixed(6),
                contractInteractions
            };
        }

        return {
            totalTxsAPI: transactions.length,
            totalETHSent: totalETHSent.toFixed(6),
            totalETHReceived: totalETHReceived.toFixed(6),
            totalFees: totalFees.toFixed(6),
            contractInteractions
        };
    } catch (error) {
        console.error(`Error fetching Blockscout transactions for ${address}: ${error.message}`);

        // Retry on 429 errors or any fetch failure
        console.log(`Retrying Blockscout API for ${address}. Waiting for ${delay} ms...`);
        await wait(delay);
        return fetchBlockscoutTransactions(address, delay * 1.05 , next_page_params);  // Retry indefinitely with exponential backoff
    }
};

const fetchScrollscanTransactions = async (address, delay = 1000, page = 1, totalTransactions = 0, totalETHSent = 0, totalETHReceived = 0, totalFees = 0, contractInteractions = 0, maxRetries = 5) => {
    const url = `${process.env.SCROLLSCAN_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=latest&sort=asc&page=${page}&offset=10000&apikey=${process.env.API_KEY_SCROLL}`;

    try {
        console.log(`Fetching Scrollscan transactions for ${address} (page: ${page}) from: ${url}`);
        const response = await axios.get(url);
        const transactions = response.data.result;

        if (!transactions || transactions.length === 0) {
            throw new Error('No transactions found');
        }

        // Process each transaction
        for (const tx of transactions) {
            const fromAddress = tx.from ? tx.from.toLowerCase() : null;
            const toAddress = tx.to ? tx.to.toLowerCase() : null;

            // Skip transactions where from/to is missing
            if (!fromAddress || !toAddress) {
                console.warn(`Skipping transaction ${tx.hash} due to missing from or to address`);
                continue;
            }

            // If the transaction is initiated by the target address (ETH sent)
            if (fromAddress === address.toLowerCase()) {
                totalETHSent += parseFloat(tx.value) / 10 ** 18;
                totalFees += parseFloat(tx.gasUsed) * parseFloat(tx.gasPrice) / 10 ** 18;
            }

            // If the target address is the recipient (ETH received)
            if (toAddress === address.toLowerCase()) {
                totalETHReceived += parseFloat(tx.value) / 10 ** 18;
            }

            // Count contract interactions (if the methodId indicates a contract call)
            if (tx.methodId && tx.methodId !== '0x') {
                contractInteractions++;
            }
        }

        totalTransactions += transactions.length; // Accumulate total number of transactions

        // If the total transactions reach 10,000, stop fetching more
        if (totalTransactions >= 10000) {
            console.log(`Reached limit of 10,000 transactions for ${address}. Stopping.`);
            return {
                totalTxsAPI: totalTransactions,
                totalETHSent: totalETHSent.toFixed(6),
                totalETHReceived: totalETHReceived.toFixed(6),
                totalFees: totalFees.toFixed(6),
                contractInteractions
            };
        }

        // Introduce a delay before fetching the next page
        await wait(500); // Wait 500ms before fetching the next page

        // If there are more transactions, fetch the next page
        if (transactions.length === 10000) {
            return await fetchScrollscanTransactions(address, delay, page + 1, totalTransactions, totalETHSent, totalETHReceived, totalFees, contractInteractions, maxRetries);
        }

        // Return the accumulated results after all pages are fetched
        return {
            totalTxsAPI: totalTransactions,
            totalETHSent: totalETHSent.toFixed(6),
            totalETHReceived: totalETHReceived.toFixed(6),
            totalFees: totalFees.toFixed(6),
            contractInteractions
        };
    } catch (error) {
        console.error(`Error fetching Scrollscan transactions for ${address} (page: ${page}): ${error.message}`);

        // Retry on errors or rate limiting, with a max retries limit
        if (maxRetries > 0) {
            console.log(`Retrying Scrollscan API for ${address} (page: ${page}). Waiting for ${delay} ms...`);
            await wait(delay); // Wait for the specified delay before retrying
            return fetchScrollscanTransactions(address, delay * 2, page, totalTransactions, totalETHSent, totalETHReceived, totalFees, contractInteractions, maxRetries - 1); // Retry with exponential backoff
        } else {
            console.error(`Max retries reached for page ${page}. Skipping to next page for ${address}.`);
            return {
                totalTxsAPI: totalTransactions,
                totalETHSent: totalETHSent.toFixed(6),
                totalETHReceived: totalETHReceived.toFixed(6),
                totalFees: totalFees.toFixed(6),
                contractInteractions
            }; // Return the results so far
        }
    }
};

    
    module.exports = {
        fetchBlockscoutTransactions,
        fetchScrollscanTransactions
    };