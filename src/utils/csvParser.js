import Papa from 'papaparse';

/**
 * Parse CSV file and detect brokerage source
 * @param {File} file - CSV file to parse
 * @returns {Promise<{transactions: Array, source: string}>}
 */
export async function parseCSV(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const headers = results.meta.fields;
                    const source = detectSource(headers);
                    const transactions = normalizeTransactions(results.data, source);
                    resolve({ transactions, source });
                } catch (error) {
                    reject(error);
                }
            },
            error: (error) => {
                reject(error);
            }
        });
    });
}

/**
 * Detect brokerage source from CSV headers
 */
function detectSource(headers) {
    const headerStr = headers.join(',').toLowerCase();

    // Fidelity has "Run Date" and "Settlement Date"
    if (headerStr.includes('run date') && headerStr.includes('settlement date')) {
        return 'fidelity';
    }

    // Schwab typically has "Date" and "Exchange Rate"
    if (headerStr.includes('exchange rate') || headerStr.includes('exchange currency')) {
        return 'schwab';
    }

    // Default to fidelity if unclear
    return 'fidelity';
}

/**
 * Normalize transactions to common format
 */
function normalizeTransactions(data, source) {
    if (source === 'fidelity') {
        return normalizeFidelity(data);
    } else {
        return normalizeSchwab(data);
    }
}

/**
 * Normalize Fidelity CSV format
 */
function normalizeFidelity(data) {
    return data.map(row => {
        const action = row.Action?.toUpperCase() || '';
        const symbol = (row.Symbol || '').trim();
        const quantity = parseFloat(row.Quantity) || 0;
        const price = parseFloat(row['Price ($)']) || 0;
        const commission = parseFloat(row['Commission ($)']) || 0;
        const fees = parseFloat(row['Fees ($)']) || 0;
        const amount = parseFloat(row['Amount ($)']) || 0;
        const date = parseDate(row['Run Date']);
        const accountType = row['Type'] || '';

        // Detect if this is an option transaction
        const isOption = symbol.startsWith('-') || action.includes('CALL') || action.includes('PUT');
        const optionDetails = isOption ? parseOptionSymbol(symbol) : null;

        // Determine transaction type
        let transactionType = 'OTHER';
        if (action.includes('YOU BOUGHT') && !isOption) {
            transactionType = 'BUY';
        } else if (action.includes('YOU SOLD') && !isOption && !action.includes('OPENING') && !action.includes('CLOSING')) {
            transactionType = 'SELL';
        } else if (action.includes('DIVIDEND')) {
            transactionType = 'DIVIDEND';
        } else if (action.includes('YOU SOLD') && action.includes('OPENING')) {
            transactionType = 'OPTION_SELL_OPEN';
        } else if (action.includes('YOU BOUGHT') && action.includes('OPENING')) {
            transactionType = 'OPTION_BUY_OPEN';
        } else if (action.includes('YOU SOLD') && action.includes('CLOSING')) {
            transactionType = 'OPTION_SELL_CLOSE';
        } else if (action.includes('YOU BOUGHT') && action.includes('CLOSING')) {
            transactionType = 'OPTION_BUY_CLOSE';
        } else if (action.includes('ASSIGNED')) {
            transactionType = 'OPTION_ASSIGNED';
        } else if (action.includes('EXPIRED')) {
            transactionType = 'OPTION_EXPIRED';
        }

        return {
            date,
            action: action,
            transactionType,
            symbol: symbol.replace('-', ''), // Remove leading dash from options
            description: row.Description || '',
            quantity: Math.abs(quantity),
            price,
            commission,
            fees,
            amount,
            isOption,
            optionDetails,
            rawData: row
        };
    }).filter(t => t.symbol); // Filter out rows without symbols
}

/**
 * Normalize Schwab CSV format
 */
function normalizeSchwab(data) {
    return data.map(row => {
        const action = row.Action?.toUpperCase() || '';
        const symbol = (row.Symbol || '').trim();
        const quantity = parseFloat(row.Quantity) || 0;
        const price = parseFloat(row.Price) || 0;
        const feesComm = parseFloat(row['Fees & Comm']) || 0;
        const amount = parseFloat(row.Amount) || 0;
        const date = parseDate(row.Date || row['Run Date']);

        const isOption = symbol.includes('CALL') || symbol.includes('PUT');
        const optionDetails = isOption ? parseOptionSymbol(symbol) : null;

        let transactionType = 'OTHER';
        if (action.includes('BUY') && !isOption) {
            transactionType = 'BUY';
        } else if (action.includes('SELL') && !isOption) {
            transactionType = 'SELL';
        } else if (action.includes('DIVIDEND')) {
            transactionType = 'DIVIDEND';
        }

        return {
            date,
            action,
            transactionType,
            symbol,
            description: row.Description || '',
            quantity: Math.abs(quantity),
            price,
            commission: feesComm,
            fees: 0,
            amount,
            isOption,
            optionDetails,
            rawData: row
        };
    }).filter(t => t.symbol);
}

/**
 * Parse option symbol (e.g., BMNR260109C31.5 or -BMNR260109C31.5)
 */
function parseOptionSymbol(symbol) {
    // Remove leading dash if present
    const cleanSymbol = symbol.replace('-', '');

    // Try to match option format: TICKER + YYMMDD + C/P + STRIKE
    const match = cleanSymbol.match(/^([A-Z]+)(\d{6})([CP])([\d.]+)$/);

    if (match) {
        const [, ticker, dateStr, type, strike] = match;
        const year = 2000 + parseInt(dateStr.substring(0, 2));
        const month = parseInt(dateStr.substring(2, 4)) - 1;
        const day = parseInt(dateStr.substring(4, 6));

        return {
            ticker,
            expiry: new Date(year, month, day),
            type: type === 'C' ? 'CALL' : 'PUT',
            strike: parseFloat(strike)
        };
    }

    return null;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr) {
    if (!dateStr) return new Date();

    // Try MM/DD/YYYY format (Fidelity)
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const [month, day, year] = parts;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Fallback to Date constructor
    return new Date(dateStr);
}
