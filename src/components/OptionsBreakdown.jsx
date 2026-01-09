function OptionsBreakdown({ strategyData, winRate }) {
    const formatCurrency = (value) => {
        if (value === undefined || value === null) return '$0.00';
        const formatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(Math.abs(value));

        return value < 0 ? `-${formatted}` : formatted;
    };

    const strategies = [
        {
            key: 'coveredCalls',
            name: 'Covered Calls',
            icon: '📈',
            description: 'Calls sold against owned stock',
            color: '#10b981'
        },
        {
            key: 'cashSecuredPuts',
            name: 'Cash-Secured Puts',
            icon: '💵',
            description: 'Puts sold with cash to cover',
            color: '#6366f1'
        },

        {
            key: 'longCalls',
            name: 'Long Calls',
            icon: '🎯',
            description: 'Calls purchased',
            color: '#f59e0b'
        },
        {
            key: 'longPuts',
            name: 'Long Puts',
            icon: '🛡️',
            description: 'Puts purchased',
            color: '#ec4899'
        }
    ];

    // Calculate total premium income from short strategies
    const totalPremiumCollected =
        (strategyData.coveredCalls?.premiumCollected || 0) +
        (strategyData.cashSecuredPuts?.premiumCollected || 0);

    return (
        <div className="card mt-lg">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h2>Options Strategy Breakdown</h2>
                <div style={{
                    background: 'rgba(99, 102, 241, 0.2)',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem'
                }}>
                    Win Rate: <strong style={{ color: winRate >= 50 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {winRate.toFixed(1)}%
                    </strong>
                </div>
            </div>

            {/* Premium Income Summary */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                padding: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-md)',
                textAlign: 'center'
            }}>
                Total Premium Collected (Covered Calls + CSPs)
                <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-success)' }}>
                    {formatCurrency(totalPremiumCollected)}
                </div>
            </div>

            {/* Strategy Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--spacing-md)'
            }}>
                {strategies.map(strategy => {
                    const data = strategyData[strategy.key] || {};
                    const isShortStrategy = strategy.key === 'coveredCalls' ||
                        strategy.key === 'cashSecuredPuts' ||
                        strategy.key === 'nakedCalls';

                    return (
                        <div
                            key={strategy.key}
                            style={{
                                background: 'rgba(30, 30, 50, 0.6)',
                                border: `1px solid ${strategy.color}33`,
                                borderRadius: '12px',
                                padding: 'var(--spacing-md)',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--spacing-sm)' }}>
                                <span style={{ fontSize: '1.5rem' }}>{strategy.icon}</span>
                                <div>
                                    <h3 style={{ margin: 0, color: strategy.color }}>{strategy.name}</h3>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        {strategy.description}
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '0.5rem',
                                fontSize: '0.875rem'
                            }}>
                                {isShortStrategy ? (
                                    <>
                                        <div>
                                            <div style={{ color: 'var(--color-text-muted)' }}>Premium Collected</div>
                                            <div style={{ fontWeight: '600', color: 'var(--color-success)' }}>
                                                {formatCurrency(data.premiumCollected || 0)}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--color-text-muted)' }}>Premium Retained</div>
                                            <div style={{ fontWeight: '600', color: 'var(--color-success)' }}>
                                                {formatCurrency(data.premiumRetained || 0)}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--color-text-muted)' }}>Premium Lost</div>
                                            <div style={{ fontWeight: '600', color: 'var(--color-danger)' }}>
                                                {formatCurrency(data.premiumLost || 0)}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--color-text-muted)' }}>Net P&L</div>
                                            <div style={{
                                                fontWeight: '600',
                                                color: (data.netPL || 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                                            }}>
                                                {formatCurrency(data.netPL || 0)}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <div style={{ color: 'var(--color-text-muted)' }}>Premium Paid</div>
                                            <div style={{ fontWeight: '600' }}>
                                                {formatCurrency(data.premiumPaid || 0)}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--color-text-muted)' }}>Trades</div>
                                            <div style={{ fontWeight: '600' }}>
                                                {data.tradesCount || 0}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--color-text-muted)' }}>Gains</div>
                                            <div style={{ fontWeight: '600', color: 'var(--color-success)' }}>
                                                {formatCurrency(data.gains || 0)}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--color-text-muted)' }}>Losses</div>
                                            <div style={{ fontWeight: '600', color: 'var(--color-danger)' }}>
                                                {formatCurrency(data.losses || 0)}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div style={{
                                marginTop: 'var(--spacing-sm)',
                                paddingTop: 'var(--spacing-sm)',
                                borderTop: '1px solid rgba(255,255,255,0.1)',
                                fontSize: '0.875rem',
                                color: 'var(--color-text-muted)'
                            }}>
                                {data.tradesCount || 0} trade{(data.tradesCount || 0) !== 1 ? 's' : ''}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default OptionsBreakdown;
