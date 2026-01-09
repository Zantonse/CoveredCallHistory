/**
 * Calculate annualized return using XIRR (Internal Rate of Return)
 * This accounts for the timing of cash flows
 * 
 * @param {Array} transactions - All transactions
 * @param {number} currentValue - Current portfolio value
 * @returns {number} - Annualized return as a percentage
 */
export function calculateXIRR(transactions, currentValue = 0) {
    // Build cash flow array
    const cashFlows = buildCashFlows(transactions, currentValue);

    if (cashFlows.length < 2) {
        return 0;
    }

    // Use Newton's method to find XIRR
    const xirr = newtonXIRR(cashFlows);

    return xirr * 100; // Return as percentage
}

/**
 * Build cash flow array from transactions
 * Negative = money out (buys), Positive = money in (sells, dividends)
 */
function buildCashFlows(transactions, currentValue) {
    const cashFlows = [];

    // Sort transactions by date
    const sorted = [...transactions].sort((a, b) => a.date - b.date);

    for (const txn of sorted) {
        const { date, transactionType, amount } = txn;

        if (transactionType === 'BUY' || transactionType === 'OPTION_BUY_OPEN') {
            // Money out (negative)
            cashFlows.push({
                date,
                amount: -Math.abs(amount)
            });
        } else if (transactionType === 'SELL' || transactionType === 'OPTION_SELL_OPEN') {
            // Money in (positive)
            cashFlows.push({
                date,
                amount: Math.abs(amount)
            });
        } else if (transactionType === 'DIVIDEND') {
            // Dividend received (positive)
            cashFlows.push({
                date,
                amount: Math.abs(amount)
            });
        }
    }

    // Add current value as final cash flow (if we were to liquidate today)
    if (currentValue > 0) {
        cashFlows.push({
            date: new Date(),
            amount: currentValue
        });
    }

    return cashFlows;
}

/**
 * Calculate XIRR using Newton's method
 */
function newtonXIRR(cashFlows, guess = 0.1, maxIterations = 100, tolerance = 0.0001) {
    let rate = guess;

    for (let i = 0; i < maxIterations; i++) {
        const npv = calculateNPV(cashFlows, rate);
        const derivative = calculateDerivative(cashFlows, rate);

        if (Math.abs(derivative) < 1e-10) {
            break;
        }

        const newRate = rate - npv / derivative;

        if (Math.abs(newRate - rate) < tolerance) {
            return newRate;
        }

        rate = newRate;
    }

    return rate;
}

/**
 * Calculate Net Present Value
 */
function calculateNPV(cashFlows, rate) {
    const firstDate = cashFlows[0].date;
    let npv = 0;

    for (const cf of cashFlows) {
        const years = daysBetween(firstDate, cf.date) / 365;
        npv += cf.amount / Math.pow(1 + rate, years);
    }

    return npv;
}

/**
 * Calculate derivative of NPV (for Newton's method)
 */
function calculateDerivative(cashFlows, rate) {
    const firstDate = cashFlows[0].date;
    let derivative = 0;

    for (const cf of cashFlows) {
        const years = daysBetween(firstDate, cf.date) / 365;
        derivative -= years * cf.amount / Math.pow(1 + rate, years + 1);
    }

    return derivative;
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1, date2) {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.abs((date2 - date1) / msPerDay);
}

/**
 * Simple annualized return calculation (alternative to XIRR)
 * Uses total return over holding period
 */
export function calculateSimpleAnnualizedReturn(totalInvested, currentValue, startDate, endDate) {
    if (totalInvested <= 0) return 0;

    const totalReturn = (currentValue - totalInvested) / totalInvested;
    const years = daysBetween(startDate, endDate) / 365;

    if (years <= 0) return 0;

    // Annualize: (1 + total return) ^ (1 / years) - 1
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;

    return annualizedReturn * 100; // Return as percentage
}
