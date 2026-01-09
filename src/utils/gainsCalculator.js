/**
 * Calculate gains and losses using FIFO (First In, First Out) method
 * Enhanced with option type classification (covered calls, cash-secured puts, etc.)
 * @param {Array} transactions - Normalized transactions
 * @returns {Object} - Gains/losses summary and detailed trades
 */
export function calculateGainsLosses(transactions, taxStrategy = 'FIFO') {
    // Separate stock and option transactions
    const stockTransactions = transactions.filter(t => !t.isOption);
    const optionTransactions = transactions.filter(t => t.isOption);

    // Build set of symbols we have evidence of owning
    // Evidence includes: dividends received, assigned calls (means we had shares), BUY transactions
    const ownedSymbols = new Set();

    for (const txn of transactions) {
        const symbol = txn.symbol?.replace('-', '');

        // Dividend = proof of ownership
        if (txn.transactionType === 'DIVIDEND') {
            ownedSymbols.add(symbol);
        }
        // Assigned call = we had shares that got called away
        if (txn.action?.includes('ASSIGNED') && txn.action?.includes('CALL')) {
            // Extract underlying from the option
            const underlying = getUnderlyingSymbol(symbol);
            ownedSymbols.add(underlying);
        }
        // Sold shares from assigned calls = we owned them
        if (txn.action?.includes('SOLD') && txn.action?.includes('ASSIGNED')) {
            ownedSymbols.add(symbol);
        }
        // Regular SELL = we owned them (unless short, which parser handles separately)
        if (txn.transactionType === 'SELL') {
            ownedSymbols.add(symbol);
        }
    }

    // Calculate stock gains/losses first (we need positions for covered call detection)
    const stockResults = calculateStockGains(stockTransactions, taxStrategy);

    // Calculate option gains/losses with stock positions AND ownership evidence
    const optionResults = calculateOptionGains(optionTransactions, stockResults.openPositions, ownedSymbols);

    // Combine results
    const totalRealizedGains = stockResults.totalRealizedGains + optionResults.totalRealizedGains;
    const totalRealizedLosses = stockResults.totalRealizedLosses + optionResults.totalRealizedLosses;
    const netPL = totalRealizedGains + totalRealizedLosses;

    return {
        totalRealizedGains,
        totalRealizedLosses,
        netPL,
        stockResults,
        optionResults,
        allTrades: [...stockResults.trades, ...optionResults.trades]
    };
}

/**
 * Extract underlying symbol from option symbol
 * e.g., BMNR260109C31.5 -> BMNR
 */
function getUnderlyingSymbol(optionSymbol) {
    if (!optionSymbol) return '';
    const cleanSymbol = optionSymbol.replace('-', '');
    const match = cleanSymbol.match(/^([A-Z]+)/);
    return match ? match[1] : cleanSymbol;
}

/**
 * Calculate stock gains/losses using FIFO
 */
/**
 * Calculate stock gains/losses using specified tax lot strategy
 */
function calculateStockGains(transactions, strategy = 'FIFO') {
    const positions = {}; // Track cost basis per symbol
    const trades = [];
    let totalRealizedGains = 0;
    let totalRealizedLosses = 0;

    // Track split totals
    const stockResults = {
        shortTermGains: 0,
        shortTermLosses: 0,
        longTermGains: 0,
        longTermLosses: 0
    };

    // Sort by date
    const sorted = [...transactions].sort((a, b) => a.date - b.date);

    for (const txn of sorted) {
        const { symbol, transactionType, quantity, price, commission, fees, date, amount } = txn;

        if (transactionType === 'BUY') {
            // Add to position
            if (!positions[symbol]) {
                positions[symbol] = [];
            }

            const costPerShare = price + (commission + fees) / quantity;
            positions[symbol].push({
                quantity,
                costPerShare,
                date
            });

            trades.push({
                date,
                symbol,
                type: 'BUY',
                quantity,
                price,
                totalCost: quantity * price + commission + fees,
                realizedPL: 0
            });

        } else if (transactionType === 'SELL') {
            // Sell using Tax Strategy
            // Handle Orphaned Sells (Missing Buy History)
            // If we have no position, assume it's a legacy holding (LONG TERM) with 0 known cost basis (100% gain)
            // or perhaps $0 cost basis is safer than ignoring it.
            let positionList = positions[symbol] || [];

            // If totally empty, treat as orphaned lot
            if (positionList.length === 0) {
                const totalProceeds = quantity * price - commission - fees;
                const estimatedCost = 0; // Conservative: 100% gain
                const realizedPL = totalProceeds - estimatedCost;

                // Add to Long Term Gains
                if (realizedPL > 0) stockResults.longTermGains += realizedPL;
                else stockResults.longTermLosses += realizedPL;
                totalRealizedGains += realizedPL;

                trades.push({
                    date,
                    symbol,
                    type: 'SELL',
                    quantity,
                    price,
                    totalProceeds,
                    totalCost: estimatedCost,
                    realizedPL,
                    term: 'LONG', // Default assumption for missing history
                    lots: [{
                        quantity,
                        date: new Date(0), // Epoch start as proxy for "old"
                        cost: estimatedCost,
                        proceeds: totalProceeds,
                        realizedPL,
                        term: 'LONG',
                        note: 'Missing buy history - Assumed Long Term'
                    }]
                });
                continue;
            }

            let remainingToSell = quantity;
            let totalCost = 0;
            let totalProceeds = quantity * price - commission - fees;
            const soldLots = [];

            while (remainingToSell > 0 && positionList.length > 0) {
                // Select lot based on strategy
                let lotIndex;
                if (strategy === 'LIFO') {
                    lotIndex = positions[symbol].length - 1; // Last In
                } else if (strategy === 'HIFO') {
                    // Highest Cost In
                    // Find index of lot with highest costPerShare
                    lotIndex = 0;
                    let maxCost = -1;
                    positions[symbol].forEach((lot, idx) => {
                        if (lot.costPerShare > maxCost) {
                            maxCost = lot.costPerShare;
                            lotIndex = idx;
                        }
                    });
                } else {
                    // FIFO (default)
                    lotIndex = 0; // First In
                }

                const lot = positionList[lotIndex];

                // Calculate holding period
                const buyDate = new Date(lot.date);
                const sellDate = new Date(date);
                const diffTime = Math.abs(sellDate - buyDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const term = diffDays > 365 ? 'LONG' : 'SHORT';

                if (lot.quantity <= remainingToSell) {
                    // Sell entire lot
                    const lotCost = lot.quantity * lot.costPerShare;
                    const lotProceeds = (lot.quantity / quantity) * totalProceeds; // Pro-rated proceeds
                    const lotPL = lotProceeds - lotCost;

                    totalCost += lotCost;

                    if (term === 'LONG') {
                        // totalRealizedLongTermGains += ... (if we were tracking globally)
                    }

                    soldLots.push({
                        quantity: lot.quantity,
                        date: lot.date,
                        cost: lotCost,
                        proceeds: lotProceeds,
                        realizedPL: lotPL,
                        daysHeld: diffDays,
                        term
                    });

                    remainingToSell -= lot.quantity;
                    // Remove lot
                    positionList.splice(lotIndex, 1);
                } else {
                    // Partial sell
                    const sellQuantity = remainingToSell;
                    const lotCost = sellQuantity * lot.costPerShare;
                    const lotProceeds = (sellQuantity / quantity) * totalProceeds;
                    const lotPL = lotProceeds - lotCost;

                    totalCost += lotCost;

                    soldLots.push({
                        quantity: sellQuantity,
                        date: lot.date,
                        cost: lotCost,
                        proceeds: lotProceeds,
                        realizedPL: lotPL,
                        daysHeld: diffDays,
                        term
                    });

                    lot.quantity -= sellQuantity;
                    remainingToSell = 0;
                }
            }

            // Handle "Partial Orphan" (Selling more than we have tracked)
            if (remainingToSell > 0) {
                const fraction = remainingToSell / quantity;
                const orphanProceeds = fraction * totalProceeds;
                const orphanCost = 0; // Assumed zero basis
                const orphanPL = orphanProceeds - orphanCost;

                // Assume Long Term for the untracked portion
                if (orphanPL > 0) stockResults.longTermGains += orphanPL;
                else stockResults.longTermLosses += orphanPL;

                soldLots.push({
                    quantity: remainingToSell,
                    date: new Date(0),
                    cost: orphanCost,
                    proceeds: orphanProceeds,
                    realizedPL: orphanPL,
                    term: 'LONG',
                    note: 'Missing buy history (Partial)'
                });

                totalCost += orphanCost;
            }

            const realizedPL = totalProceeds - totalCost;

            if (realizedPL > 0) {
                totalRealizedGains += realizedPL;
            } else {
                totalRealizedLosses += realizedPL;
            }

            // Determine overall term for the trade
            const terms = new Set(soldLots.map(l => l.term));
            const tradeTerm = terms.size > 1 ? 'MIXED' : (terms.values().next().value || 'SHORT');

            // Accumulate Short/Long Term totals based on LOTS (more accurate than mixed trade level)
            soldLots.forEach(lot => {
                if (lot.term === 'LONG') {
                    if (lot.realizedPL > 0) stockResults.longTermGains += lot.realizedPL;
                    else stockResults.longTermLosses += lot.realizedPL;
                } else {
                    if (lot.realizedPL > 0) stockResults.shortTermGains += lot.realizedPL;
                    else stockResults.shortTermLosses += lot.realizedPL;
                }
            });

            trades.push({
                date,
                symbol,
                type: 'SELL',
                quantity,
                price,
                totalProceeds,
                totalCost,
                realizedPL,
                term: tradeTerm,
                lots: soldLots
            });
        }
    }

    // Wash Sale Detection (Estimation)
    // defined as: Sell at loss AND buy same security within +/- 30 days
    trades.forEach(trade => {
        if (trade.realizedPL < 0 && trade.type === 'SELL') { // Ensure it's a stock sell
            const sellDate = new Date(trade.date);
            const sellTime = sellDate.getTime();
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

            // Get buy dates of the sold lots to exclude them
            // (prevents flagging the opening trade itself as the "wash" buy)
            const soldBuyDates = new Set(
                (trade.lots || []).map(l => new Date(l.date).getTime())
            );

            // Look for any OTHER buy of same symbol within window
            const replacementShare = transactions.find(t => {
                if (t.symbol !== trade.symbol || t.transactionType !== 'BUY') return false;

                const buyDate = new Date(t.date);
                const buyTime = buyDate.getTime();

                // Exclude the lot we just sold
                if (soldBuyDates.has(buyTime)) return false;

                const diffTime = Math.abs(buyTime - sellTime);
                return diffTime <= thirtyDaysMs;
            });

            if (replacementShare) {
                trade.isWashSale = true;
                trade.washSaleMsg = `Potential wash sale: Bought on ${new Date(replacementShare.date).toLocaleDateString()}`;
            }
        }
    });

    return {
        totalRealizedGains,
        totalRealizedLosses,
        shortTermGains: stockResults.shortTermGains,
        shortTermLosses: stockResults.shortTermLosses,
        longTermGains: stockResults.longTermGains,
        longTermLosses: stockResults.longTermLosses,
        trades,
        openPositions: positions
    };
}

/**
 * Get total shares owned for a symbol at a given time
 */
function getSharesOwned(positions, underlyingSymbol) {
    if (!positions[underlyingSymbol]) return 0;
    return positions[underlyingSymbol].reduce((sum, lot) => sum + lot.quantity, 0);
}

/**
 * Determine if option is a CALL or PUT from symbol
 */
function getOptionType(optionSymbol) {
    if (optionSymbol.includes('C')) {
        // Check if it's a call by looking at the pattern
        const match = optionSymbol.match(/\d{6}([CP])/);
        if (match) {
            return match[1] === 'C' ? 'CALL' : 'PUT';
        }
    }
    if (optionSymbol.includes('P')) {
        const match = optionSymbol.match(/\d{6}([CP])/);
        if (match) {
            return match[1] === 'C' ? 'CALL' : 'PUT';
        }
    }
    // Default based on simple check
    return optionSymbol.includes('C') ? 'CALL' : 'PUT';
}

/**
 * Calculate option gains/losses with strategy classification
 */
function calculateOptionGains(transactions, stockPositions = {}, ownedSymbols = new Set()) {
    const optionPositions = {}; // Track option positions
    const trades = [];
    let totalRealizedGains = 0;
    let totalRealizedLosses = 0;

    // Track short/long term totals for options
    // Note: Options are typically treated as SHORT-TERM capital gains/losses
    // regardless of holding period (US tax treatment)
    const optionTaxResults = {
        shortTermGains: 0,
        shortTermLosses: 0,
        longTermGains: 0,
        longTermLosses: 0
    };

    // Strategy-specific tracking
    const strategyResults = {
        coveredCalls: {
            premiumCollected: 0,
            premiumRetained: 0,  // Expired worthless or assigned
            premiumLost: 0,      // Closed at loss
            tradesCount: 0,
            trades: []
        },
        nakedCalls: {
            premiumCollected: 0,
            premiumRetained: 0,
            premiumLost: 0,
            tradesCount: 0,
            trades: []
        },
        cashSecuredPuts: {
            premiumCollected: 0,
            premiumRetained: 0,
            premiumLost: 0,
            tradesCount: 0,
            trades: []
        },
        longCalls: {
            premiumPaid: 0,
            gains: 0,
            losses: 0,
            tradesCount: 0,
            trades: []
        },
        longPuts: {
            premiumPaid: 0,
            gains: 0,
            losses: 0,
            tradesCount: 0,
            trades: []
        }
    };

    // Sort by date
    const sorted = [...transactions].sort((a, b) => a.date - b.date);

    for (const txn of sorted) {
        const { symbol, transactionType, quantity, price, commission, fees, date, amount } = txn;
        const underlyingSymbol = getUnderlyingSymbol(symbol);
        const optionType = getOptionType(symbol);
        const sharesOwned = getSharesOwned(stockPositions, underlyingSymbol);
        const contractsNeededForCovered = Math.floor(sharesOwned / 100);

        // Check if we have evidence of ownership (dividends, assignments, etc.)
        const hasOwnershipEvidence = ownedSymbols.has(underlyingSymbol);

        if (transactionType === 'OPTION_SELL_OPEN') {
            // Selling to open (collecting premium)
            const premiumCollected = Math.abs(amount);

            // Determine strategy type
            let strategy;
            if (optionType === 'CALL') {
                // Check if covered: either have shares tracked OR have ownership evidence (dividends) OR is Cash account
                // User Insight: Due to missing history for long-held stocks, assume ALL short calls are Covered
                // unless we have specific reason to think otherwise. Defaulting to Covered prevents scary "Naked" warnings.
                strategy = 'coveredCalls';

                // (Preserving logic for future "Strict Mode" if needed)
                // const isCashAccount = txn.accountType === 'Cash';
                // if (contractsNeededForCovered >= quantity || hasOwnershipEvidence || isCashAccount) {
                //     strategy = 'coveredCalls';
                // } else {
                //     strategy = 'coveredCalls'; // Default to covered
                // }
            } else {
                strategy = 'cashSecuredPuts';
            }

            if (!optionPositions[symbol]) {
                optionPositions[symbol] = [];
            }

            optionPositions[symbol].push({
                quantity,
                premiumPerContract: premiumCollected / quantity,
                date,
                type: 'SHORT',
                strategy,
                optionType
            });

            // Track in strategy results
            strategyResults[strategy].premiumCollected += premiumCollected;
            strategyResults[strategy].tradesCount++;

            const trade = {
                date,
                symbol,
                underlyingSymbol,
                type: 'SELL_OPEN',
                optionType,
                strategy,
                quantity,
                premium: premiumCollected,
                realizedPL: 0
            };

            trades.push(trade);
            strategyResults[strategy].trades.push(trade);

        } else if (transactionType === 'OPTION_BUY_OPEN') {
            // Buying to open (paying premium)
            const premiumPaid = Math.abs(amount);

            const strategy = optionType === 'CALL' ? 'longCalls' : 'longPuts';

            if (!optionPositions[symbol]) {
                optionPositions[symbol] = [];
            }

            optionPositions[symbol].push({
                quantity,
                premiumPerContract: premiumPaid / quantity,
                date,
                type: 'LONG',
                strategy,
                optionType
            });

            strategyResults[strategy].premiumPaid += premiumPaid;
            strategyResults[strategy].tradesCount++;

            const trade = {
                date,
                symbol,
                underlyingSymbol,
                type: 'BUY_OPEN',
                optionType,
                strategy,
                quantity,
                premium: premiumPaid,
                realizedPL: 0
            };

            trades.push(trade);
            strategyResults[strategy].trades.push(trade);

        } else if (transactionType === 'OPTION_BUY_CLOSE') {
            // Buying to close (closing short position)
            const premiumPaid = Math.abs(amount);

            if (optionPositions[symbol] && optionPositions[symbol].length > 0) {
                let remainingToClose = quantity;
                let totalPremiumCollected = 0;
                let strategy = optionPositions[symbol][0]?.strategy || 'nakedCalls';

                while (remainingToClose > 0 && optionPositions[symbol].length > 0) {
                    const position = optionPositions[symbol][0];
                    strategy = position.strategy;

                    if (position.quantity <= remainingToClose) {
                        totalPremiumCollected += position.quantity * position.premiumPerContract;
                        remainingToClose -= position.quantity;
                        optionPositions[symbol].shift();
                    } else {
                        totalPremiumCollected += remainingToClose * position.premiumPerContract;
                        position.quantity -= remainingToClose;
                        remainingToClose = 0;
                    }
                }

                const realizedPL = totalPremiumCollected - premiumPaid;

                if (realizedPL > 0) {
                    totalRealizedGains += realizedPL;
                    strategyResults[strategy].premiumRetained += realizedPL;
                    // Options are treated as short-term capital gains
                    optionTaxResults.shortTermGains += realizedPL;
                } else {
                    totalRealizedLosses += realizedPL;
                    strategyResults[strategy].premiumLost += Math.abs(realizedPL);
                    // Options are treated as short-term capital losses
                    optionTaxResults.shortTermLosses += realizedPL;
                }

                const trade = {
                    date,
                    symbol,
                    underlyingSymbol: getUnderlyingSymbol(symbol),
                    type: 'BUY_CLOSE',
                    optionType: getOptionType(symbol),
                    strategy,
                    quantity,
                    premium: premiumPaid,
                    totalProceeds: totalPremiumCollected, // Premium collected when opened
                    totalCost: premiumPaid, // Premium paid to close
                    realizedPL
                };

                trades.push(trade);
                strategyResults[strategy].trades.push(trade);
            }

        } else if (transactionType === 'OPTION_SELL_CLOSE') {
            // Selling to close (closing long position)
            const premiumReceived = Math.abs(amount);

            if (optionPositions[symbol] && optionPositions[symbol].length > 0) {
                let remainingToClose = quantity;
                let totalPremiumPaid = 0;
                let strategy = optionPositions[symbol][0]?.strategy || 'longCalls';

                while (remainingToClose > 0 && optionPositions[symbol].length > 0) {
                    const position = optionPositions[symbol][0];
                    strategy = position.strategy;

                    if (position.quantity <= remainingToClose) {
                        totalPremiumPaid += position.quantity * position.premiumPerContract;
                        remainingToClose -= position.quantity;
                        optionPositions[symbol].shift();
                    } else {
                        totalPremiumPaid += remainingToClose * position.premiumPerContract;
                        position.quantity -= remainingToClose;
                        remainingToClose = 0;
                    }
                }

                const realizedPL = premiumReceived - totalPremiumPaid;

                if (realizedPL > 0) {
                    totalRealizedGains += realizedPL;
                    strategyResults[strategy].gains += realizedPL;
                    // Options are treated as short-term capital gains
                    optionTaxResults.shortTermGains += realizedPL;
                } else {
                    totalRealizedLosses += realizedPL;
                    strategyResults[strategy].losses += Math.abs(realizedPL);
                    // Options are treated as short-term capital losses
                    optionTaxResults.shortTermLosses += realizedPL;
                }

                const trade = {
                    date,
                    symbol,
                    underlyingSymbol: getUnderlyingSymbol(symbol),
                    type: 'SELL_CLOSE',
                    optionType: getOptionType(symbol),
                    strategy,
                    quantity,
                    premium: premiumReceived,
                    totalProceeds: premiumReceived, // Premium received when closed
                    totalCost: totalPremiumPaid, // Premium paid when opened
                    realizedPL
                };

                trades.push(trade);
                strategyResults[strategy].trades.push(trade);
            }

        } else if (transactionType === 'OPTION_EXPIRED') {
            // Option expired worthless
            if (optionPositions[symbol] && optionPositions[symbol].length > 0) {
                const position = optionPositions[symbol].shift();
                const strategy = position.strategy;

                if (position.type === 'SHORT') {
                    // Short option expired - we keep the premium (gain)
                    const gain = position.quantity * position.premiumPerContract;
                    totalRealizedGains += gain;
                    strategyResults[strategy].premiumRetained += gain;
                    // Options are treated as short-term capital gains
                    optionTaxResults.shortTermGains += gain;

                    const trade = {
                        date,
                        symbol,
                        underlyingSymbol: getUnderlyingSymbol(symbol),
                        type: 'EXPIRED',
                        optionType: position.optionType,
                        strategy,
                        quantity: position.quantity,
                        totalProceeds: gain, // Premium collected when opened
                        totalCost: 0, // No cost to close (expired worthless)
                        realizedPL: gain
                    };

                    trades.push(trade);
                    strategyResults[strategy].trades.push(trade);
                } else {
                    // Long option expired - we lose the premium (loss)
                    const loss = -(position.quantity * position.premiumPerContract);
                    totalRealizedLosses += loss;
                    strategyResults[strategy].losses += Math.abs(loss);
                    // Options are treated as short-term capital losses
                    optionTaxResults.shortTermLosses += loss;

                    const trade = {
                        date,
                        symbol,
                        underlyingSymbol: getUnderlyingSymbol(symbol),
                        type: 'EXPIRED',
                        optionType: position.optionType,
                        strategy,
                        quantity: position.quantity,
                        totalProceeds: 0, // No proceeds (expired worthless)
                        totalCost: Math.abs(loss), // Premium paid when opened
                        realizedPL: loss
                    };

                    trades.push(trade);
                    strategyResults[strategy].trades.push(trade);
                }
            }

        } else if (transactionType === 'OPTION_ASSIGNED') {
            // Option was assigned - close the position
            if (optionPositions[symbol] && optionPositions[symbol].length > 0) {
                const position = optionPositions[symbol].shift();
                const strategy = position.strategy;
                const gain = position.quantity * position.premiumPerContract;
                totalRealizedGains += gain;
                strategyResults[strategy].premiumRetained += gain;
                // Options are treated as short-term capital gains
                optionTaxResults.shortTermGains += gain;

                const trade = {
                    date,
                    symbol,
                    underlyingSymbol: getUnderlyingSymbol(symbol),
                    type: 'ASSIGNED',
                    optionType: position.optionType,
                    strategy,
                    quantity: position.quantity,
                    totalProceeds: gain, // Premium collected when opened
                    totalCost: 0, // No cost to close (assigned)
                    realizedPL: gain
                };

                trades.push(trade);
                strategyResults[strategy].trades.push(trade);
            }
        }
    }

    // Calculate net P&L per strategy
    const strategySummary = {
        coveredCalls: {
            ...strategyResults.coveredCalls,
            netPL: strategyResults.coveredCalls.premiumRetained - strategyResults.coveredCalls.premiumLost
        },
        nakedCalls: {
            ...strategyResults.nakedCalls,
            netPL: strategyResults.nakedCalls.premiumRetained - strategyResults.nakedCalls.premiumLost
        },
        cashSecuredPuts: {
            ...strategyResults.cashSecuredPuts,
            netPL: strategyResults.cashSecuredPuts.premiumRetained - strategyResults.cashSecuredPuts.premiumLost
        },
        longCalls: {
            ...strategyResults.longCalls,
            netPL: strategyResults.longCalls.gains - strategyResults.longCalls.losses
        },
        longPuts: {
            ...strategyResults.longPuts,
            netPL: strategyResults.longPuts.gains - strategyResults.longPuts.losses
        }
    };

    // Calculate win rate
    const totalClosedTrades = trades.filter(t =>
        t.type === 'EXPIRED' || t.type === 'ASSIGNED' ||
        t.type === 'BUY_CLOSE' || t.type === 'SELL_CLOSE'
    );
    const winningTrades = totalClosedTrades.filter(t => t.realizedPL > 0);
    const winRate = totalClosedTrades.length > 0
        ? (winningTrades.length / totalClosedTrades.length) * 100
        : 0;

    return {
        totalRealizedGains,
        totalRealizedLosses,
        shortTermGains: optionTaxResults.shortTermGains,
        shortTermLosses: optionTaxResults.shortTermLosses,
        longTermGains: optionTaxResults.longTermGains,
        longTermLosses: optionTaxResults.longTermLosses,
        trades,
        openPositions: optionPositions,
        strategySummary,
        winRate
    };
}
