const { fetchBlockscoutTransactions, fetchScrollscanTransactions } = require('./fetchTransactions');
const { getTransactionCountForAddress, getBalanceForAddress } = require('./rpcHelper');

// Analyze a single wallet
const analyzeWallet = async (address) => {
   const transactionCountRPC = await getTransactionCountForAddress(address);
   const balance = await getBalanceForAddress(address);

   const transactionData = await fetchBlockscoutTransactions(address); // Or fetchScrollscanTransactions depending on the case.

   return {
      transaction_count_rpc: transactionCountRPC,
      balance: parseFloat(balance).toFixed(6),
      total_received: parseFloat(transactionData.totalETHReceived).toFixed(6),
      total_sent: parseFloat(transactionData.totalETHSent).toFixed(6),
      total_fees: parseFloat(transactionData.totalFees).toFixed(6),
      transaction_count_api: transactionData.totalTxsAPI,
      contract_interactions: transactionData.contractInteractions
   };
};

module.exports = { analyzeWallet };
