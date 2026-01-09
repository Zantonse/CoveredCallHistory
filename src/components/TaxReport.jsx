import React, { useMemo } from 'react';
import { generateTaxReport } from '../utils/pdfGenerator';

function TaxReport({ trades }) {
    const report = useMemo(() => {
        const summary = {
            shortTerm: { proceeds: 0, cost: 0, gain: 0, count: 0 },
            longTerm: { proceeds: 0, cost: 0, gain: 0, count: 0 },
            washSales: { count: 0, potentialDisallowed: 0 } // Placeholder for future deep logic
        };

        const washSaleTrades = [];

        trades.forEach(trade => {
            if (trade.type === 'SELL') { // Only count stock SELLS for Cap Gains lines usually
                // Term is now populated from gainsCalculator
                const term = trade.term === 'LONG' ? 'longTerm' : 'shortTerm';

                summary[term].proceeds += (trade.totalProceeds || 0);
                summary[term].cost += (trade.totalCost || 0);
                summary[term].gain += (trade.realizedPL || 0);
                summary[term].count++;

                if (trade.isWashSale) {
                    summary.washSales.count++;
                    washSaleTrades.push(trade);
                }
            }
        });

        return { summary, washSaleTrades };
    }, [trades]);

    const handleDownload = () => {
        generateTaxReport(trades);
    };

    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(val));
    const formatNumber = (val) => new Intl.NumberFormat('en-US').format(val);

    const SectionRow = ({ title, data, color }) => (
        <div className="report-row" style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr',
            padding: '1rem',
            borderBottom: '1px solid var(--border-color)',
            alignItems: 'center'
        }}>
            <div style={{ fontWeight: '600', color: color || 'var(--color-text)' }}>{title}</div>
            <div style={{ textAlign: 'right' }}>{formatCurrency(data.proceeds)}</div>
            <div style={{ textAlign: 'right' }}>{formatCurrency(data.cost)}</div>
            <div style={{
                textAlign: 'right',
                fontWeight: 'bold',
                color: data.gain >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
            }}>
                {data.gain < 0 ? '-' : ''}{formatCurrency(data.gain)}
            </div>
        </div>
    );

    return (
        <div className="tax-report-container">
            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <h2 style={{ margin: 0 }}>
                        Tax Season Summary (Estimated)
                    </h2>
                    <button
                        onClick={handleDownload}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <span>📄</span> Download PDF Report
                    </button>
                </div>

                <div className="report-header" style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr',
                    padding: '0.5rem 1rem',
                    background: 'rgba(255,255,255,0.05)',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    <div>Term</div>
                    <div style={{ textAlign: 'right' }}>Proceeds</div>
                    <div style={{ textAlign: 'right' }}>Cost Basis</div>
                    <div style={{ textAlign: 'right' }}>Realized Gain/Loss</div>
                </div>

                <SectionRow
                    title={`Short-Term (< 1 Year) • ${report.summary.shortTerm.count} trades`}
                    data={report.summary.shortTerm}
                    color="var(--color-accent)"
                />

                <SectionRow
                    title={`Long-Term (> 1 Year) • ${report.summary.longTerm.count} trades`}
                    data={report.summary.longTerm}
                    color="var(--color-success)"
                />

                <div className="report-total" style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr',
                    padding: '1.5rem 1rem',
                    marginTop: '1rem',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '1.1rem'
                }}>
                    <div>Net Total</div>
                    <div style={{ textAlign: 'right' }}>{formatCurrency(report.summary.shortTerm.proceeds + report.summary.longTerm.proceeds)}</div>
                    <div style={{ textAlign: 'right' }}>{formatCurrency(report.summary.shortTerm.cost + report.summary.longTerm.cost)}</div>
                    <div style={{
                        textAlign: 'right',
                        color: (report.summary.shortTerm.gain + report.summary.longTerm.gain) >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                    }}>
                        {(report.summary.shortTerm.gain + report.summary.longTerm.gain) < 0 ? '-' : ''}
                        {formatCurrency(report.summary.shortTerm.gain + report.summary.longTerm.gain)}
                    </div>
                </div>
            </div>

            {report.washSaleTrades.length > 0 && (
                <div className="card">
                    <h3 style={{ color: 'var(--color-danger)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ⚠️ Potential Wash Sales Detected ({report.washSaleTrades.length})
                    </h3>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        The following trades resulted in a loss within 30 days of purchasing a substantially identical security.
                        These losses may be disallowed for tax purposes.
                    </p>
                    <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table style={{ fontSize: '0.9rem' }}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Symbol</th>
                                    <th>Loss Amount</th>
                                    <th>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.washSaleTrades.map((t, idx) => (
                                    <tr key={idx}>
                                        <td>{new Date(t.date).toLocaleDateString()}</td>
                                        <td style={{ fontWeight: 'bold' }}>{t.symbol}</td>
                                        <td style={{ color: 'var(--color-danger)' }}>{formatCurrency(t.realizedPL)}</td>
                                        <td style={{ fontStyle: 'italic', opacity: 0.8 }}>{t.washSaleMsg}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TaxReport;
