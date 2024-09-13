const calculateAndPrintPercentiles = (walletData) => {
    const metrics = ['transaction_count_rpc', 'balance', 'total_received', 'total_sent', 'total_fees', 'transaction_count_api', 'contract_interactions'];

    // Calcular percentiles para cada métrica
    metrics.forEach((metric) => {
        const metricValues = walletData.map(wallet => parseFloat(wallet[metric]));
        const sortedValues = metricValues.slice().sort((a, b) => a - b); // Ordenar de menor a mayor

        console.log(`Percentiles for ${metric}:`);
        sortedValues.forEach((value, index) => {
            const percentile = ((index + 1) / sortedValues.length) * 100;
            console.log(`${percentile.toFixed(1)}%: ${value}`);
        });
    });
};

module.exports = { calculateAndPrintPercentiles }; // Exportar correctamente la función
