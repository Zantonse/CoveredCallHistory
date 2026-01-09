function Dashboard({ gainsLosses, annualizedReturn, source }) {
    const { totalRealizedGains, totalRealizedLosses, netPL, stockResults, optionResults } = gainsLosses;

    const formatCurrency = (value) => {
        const formatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(Math.abs(value));

        return value < 0 ? `-${formatted}` : formatted;
    };

    const formatPercent = (value) => {
        return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    };

    return (
        <div>
            <div className="mb-md" style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--color-text-muted)' }}>
                    Data Source: <strong style={{ color: 'var(--color-accent)' }}>
                        {source === 'fidelity' ? 'Fidelity' : 'Charles Schwab'}
                    </strong>
                </p>
            </div>

            <div className="stats-grid">
                {/* Total Realized Gains */}
                <div className="stat-card">
                    <div className="stat-label">Total Realized Gains</div>
                    <div className="stat-value positive">
                        {formatCurrency(totalRealizedGains)}
                    </div>
                </div>

                {/* Total Realized Losses */}
                <div className="stat-card">
                    <div className="stat-label">Total Realized Losses</div>
                    <div className="stat-value negative">
                        {formatCurrency(totalRealizedLosses)}
                    </div>
                </div>

                {/* Net P&L */}
                <div className="stat-card">
                    <div className="stat-label">Net P&L</div>
                    <div className={`stat-value ${netPL >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(netPL)}
                    </div>
                </div>

                {/* Annualized Return */}

            </div>

            {/* Breakdown by Type */}
            <div className="stats-grid mt-lg">
                {/* Stock Gains */}
                <div className="stat-card">
                    <div className="stat-label">Stock Gains</div>
                    <div className="stat-value positive">
                        {formatCurrency(stockResults.totalRealizedGains)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                        {stockResults.trades.filter(t => t.type === 'SELL').length} trades
                    </div>
                </div>

                {/* Stock Losses */}
                <div className="stat-card">
                    <div className="stat-label">Stock Losses</div>
                    <div className="stat-value negative">
                        {formatCurrency(stockResults.totalRealizedLosses)}
                    </div>
                </div>

                {/* Option Gains */}
                <div className="stat-card">
                    <div className="stat-label">Option Gains</div>
                    <div className="stat-value positive">
                        {formatCurrency(optionResults.totalRealizedGains)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                        {optionResults.trades.length} contracts
                    </div>
                </div>

                {/* Option Losses */}
                <div className="stat-card">
                    <div className="stat-label">Option Losses</div>
                    <div className="stat-value negative">
                        {formatCurrency(optionResults.totalRealizedLosses)}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
