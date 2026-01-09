import { useState } from 'react';

function TransactionTable({ transactions, trades }) {
    const [view, setView] = useState('trades'); // 'trades' or 'all'
    const [filter, setFilter] = useState('all'); // 'all', 'stocks', 'options'

    const formatCurrency = (value) => {
        if (value === undefined || value === null) return '-';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(Math.abs(value));
    };

    const formatDate = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getFilteredTrades = () => {
        if (filter === 'all') return trades;
        if (filter === 'stocks') return trades.filter(t => !t.symbol.includes('C') && !t.symbol.includes('P'));
        if (filter === 'options') return trades.filter(t => t.symbol.includes('C') || t.symbol.includes('P') || t.type.includes('OPTION'));
        return trades;
    };

    const getFilteredTransactions = () => {
        if (filter === 'all') return transactions;
        if (filter === 'stocks') return transactions.filter(t => !t.isOption);
        if (filter === 'options') return transactions.filter(t => t.isOption);
        return transactions;
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h2>Transaction Details</h2>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    {/* View Toggle */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            className={`btn ${view === 'trades' ? 'btn-primary' : ''}`}
                            onClick={() => setView('trades')}
                            style={view !== 'trades' ? { background: 'var(--bg-card)', color: 'var(--color-text)' } : {}}
                        >
                            Realized Trades
                        </button>
                        <button
                            className={`btn ${view === 'all' ? 'btn-primary' : ''}`}
                            onClick={() => setView('all')}
                            style={view !== 'all' ? { background: 'var(--bg-card)', color: 'var(--color-text)' } : {}}
                        >
                            All Transactions
                        </button>
                    </div>

                    {/* Filter */}
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-card)',
                            color: 'var(--color-text)',
                            fontFamily: 'inherit',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="all">All</option>
                        <option value="stocks">Stocks Only</option>
                        <option value="options">Options Only</option>
                    </select>
                </div>
            </div>

            <div className="table-container">
                {view === 'trades' ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Symbol</th>
                                <th>Type</th>
                                <th>Strategy</th>
                                <th>Quantity</th>
                                <th>Premium/Price</th>
                                <th>Term</th>
                                <th>Realized P&L</th>
                            </tr>
                        </thead>
                        <tbody>
                            {getFilteredTrades().length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                                        No trades found
                                    </td>
                                </tr>
                            ) : (
                                getFilteredTrades()
                                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                                    .map((trade, idx) => {
                                        // Format strategy name for display
                                        const formatStrategy = (strategy) => {
                                            if (!strategy) return '-';
                                            const names = {
                                                coveredCalls: 'Covered Call',
                                                nakedCalls: 'Naked Call',
                                                cashSecuredPuts: 'Cash-Secured Put',
                                                longCalls: 'Long Call',
                                                longPuts: 'Long Put'
                                            };
                                            return names[strategy] || strategy;
                                        };

                                        return (
                                            <tr key={idx}>
                                                <td>{formatDate(trade.date)}</td>
                                                <td style={{ fontWeight: '600', color: 'var(--color-accent)' }}>{trade.symbol}</td>
                                                <td>{trade.type}</td>
                                                <td style={{
                                                    fontSize: '0.8rem',
                                                    color: trade.strategy ? 'var(--color-text)' : 'var(--color-text-muted)'
                                                }}>
                                                    {formatStrategy(trade.strategy)}
                                                </td>
                                                <td>{trade.quantity || '-'}</td>
                                                <td>{trade.premium ? formatCurrency(trade.premium) : (trade.price ? formatCurrency(trade.price) : '-')}</td>
                                                <td>
                                                    {trade.term && (
                                                        <span style={{
                                                            fontSize: '0.75rem',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            background: trade.term === 'LONG' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                                            color: trade.term === 'LONG' ? 'var(--color-success)' : 'var(--color-accent)',
                                                            fontWeight: '600'
                                                        }}>
                                                            {trade.term}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{
                                                    fontWeight: '600',
                                                    color: trade.realizedPL > 0 ? 'var(--color-success)' : trade.realizedPL < 0 ? 'var(--color-danger)' : 'var(--color-text)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}>
                                                    {trade.realizedPL !== undefined && trade.realizedPL !== 0 ? formatCurrency(trade.realizedPL) : '-'}
                                                    {trade.isWashSale && (
                                                        <span
                                                            title={trade.washSaleMsg}
                                                            style={{ cursor: 'help', fontSize: '1.2em' }}
                                                        >
                                                            ⚠️
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                            )}
                        </tbody>
                    </table>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Action</th>
                                <th>Symbol</th>
                                <th>Quantity</th>
                                <th>Price</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {getFilteredTransactions().length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                                        No transactions found
                                    </td>
                                </tr>
                            ) : (
                                getFilteredTransactions()
                                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                                    .map((txn, idx) => (
                                        <tr key={idx}>
                                            <td>{formatDate(txn.date)}</td>
                                            <td style={{ fontSize: '0.875rem' }}>{txn.action}</td>
                                            <td style={{ fontWeight: '600', color: 'var(--color-accent)' }}>{txn.symbol}</td>
                                            <td>{txn.quantity}</td>
                                            <td>{txn.price ? formatCurrency(txn.price) : '-'}</td>
                                            <td>{formatCurrency(txn.amount)}</td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default TransactionTable;
