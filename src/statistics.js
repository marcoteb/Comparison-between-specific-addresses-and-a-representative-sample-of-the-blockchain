const calculateSampleSize = (confidenceLevel, marginOfError, populationSize, proportion = 0.5) => {
    const Z = {
        90: 1.645,
        95: 1.96,
        99: 2.576
    }[confidenceLevel] || 1.96; // Default to 95% if not provided

    const e = marginOfError;
    const p = proportion;

    const numerator = Math.pow(Z, 2) * p * (1 - p);
    const denominator = Math.pow(e, 2);

    let sampleSize = numerator / denominator;

    if (populationSize) {
        sampleSize = (sampleSize * populationSize) / (sampleSize + populationSize - 1);
    }

    return Math.ceil(sampleSize);
};

module.exports = {
    calculateSampleSize
};
