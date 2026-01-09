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

    if (sorted.length === 0) return [];

    // 1. Determine Starting Value (Initial Investment)
    // We try to infer the starting balance from the first transaction
    // Start Balance = First Txn Cash Balance - First Txn Amount (reversing the effect)
    const firstTxn = sorted[0];
    let startBalance = 0;

    // Try to get balance from raw data
    const rawBalance = parseFloat(firstTxn.rawData['Cash Balance'] || firstTxn.rawData['Cash Balance ($)']);
    if (!isNaN(rawBalance)) {
        // If it's a "Cash" account, the Amount was added/subtracted to get this balance.
        // We reverse it to get "Starting Cash" before this trade.
        startBalance = rawBalance - (firstTxn.amount || 0);
    }

    // Safety: If we can't find a balance, looking at return is meaningless without a denominator.
    // We'll use a small epsilon or the first transaction amount to prevent division by zero, 
    // but ideally this should be the full portfolio value.
    if (startBalance <= 0) startBalance = 1;

    // Add Initial Investment (Negative Flow)
    cashFlows.push({
        date: firstTxn.date,
        amount: -Math.abs(startBalance)
    });

    // 2. Add External Cash Flows (Deposits/Withdrawals)
    // We ignore internal "Buy/Sell" of stocks/options as those are just changing asset form (Cash <-> Stock)
    // We ONLY care about money entering/leaving the account entirely.
    for (const txn of sorted) {
        const desc = (txn.description || '').toLowerCase();
        const action = (txn.action || '').toLowerCase();

        // Detect Transfers
        if (action.includes('funds transfer') ||
            action.includes('deposit') ||
            action.includes('withdrawal') ||
            action.includes('check paid') ||
            desc.includes('transfer')) {

            // Deposit = Money In to Account = Investment (Negative for XIRR)
            // Withdrawal = Money Out of Account = Return (Positive for XIRR)

            // Note: In Fidelity CSV, "Amount" is typically Positive for Deposits, Negative for Withdrawals?
            // Let's verify standard behavior:
            // "Electronic Funds Transfer Received" -> Amount is +$14,000.  This is an Investment. -> XIRR expects -14000.

            if (txn.amount > 0) {
                // Deposit
                cashFlows.push({
                    date: txn.date,
                    amount: -txn.amount // Investment is negative
                });
            } else {
                // Withdrawal
                cashFlows.push({
                    date: txn.date,
                    amount: Math.abs(txn.amount) // Return is positive
                });
            }
        }
    }

    // 3. Determine Final Value
    let finalValue = currentValue;
    if (finalValue === 0) {
        // Find latest cash balance
        for (let i = sorted.length - 1; i >= 0; i--) {
            const balance = parseFloat(sorted[i].rawData['Cash Balance'] || sorted[i].rawData['Cash Balance ($)']);
            if (!isNaN(balance) && balance > 0) {
                finalValue = balance;
                break;
            }
        }
    }

    // Add Final Value (Positive Flow)
    if (finalValue > 0) {
        cashFlows.push({
            date: new Date(), // Today
            amount: finalValue
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
