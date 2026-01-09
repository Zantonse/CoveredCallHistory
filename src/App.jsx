import { useState } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import TransactionTable from './components/TransactionTable';
import OptionsBreakdown from './components/OptionsBreakdown';
import TaxReport from './components/TaxReport';
import { parseCSV } from './utils/csvParser';
import { calculateGainsLosses } from './utils/gainsCalculator';
import { calculateXIRR } from './utils/annualizedReturn';

function App() {
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [taxStrategy, setTaxStrategy] = useState('FIFO');
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'tax'

    const handleFileUpload = async (file) => {
        setLoading(true);
        setError(null);

        try {
            // Parse CSV
            const { transactions, source } = await parseCSV(file);

            // Calculate gains/losses
            const gainsLosses = calculateGainsLosses(transactions, taxStrategy);

            // Calculate XIRR
            const annualizedReturn = calculateXIRR(transactions, 0);

            setResults({
                transactions,
                source,
                gainsLosses,
                annualizedReturn
            });
        } catch (err) {
            setError(err.message || 'Failed to process CSV file');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleStrategyChange = (newStrategy) => {
        setTaxStrategy(newStrategy);
        if (results) {
            const newGains = calculateGainsLosses(results.transactions, newStrategy);
            setResults(prev => ({ ...prev, gainsLosses: newGains }));
        }
    };

    return (
        <div className="container">
            <header className="text-center mb-lg">
                <h1>FidelityTracker</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '1.125rem' }}>
                    Investment Gains & Losses Calculator
                </p>
            </header>

            {!results && (
                <FileUpload
                    onFileUpload={handleFileUpload}
                    loading={loading}
                    error={error}
                />
            )}

            {results && (
                <div className="fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        {/* Tab Switcher */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`btn ${activeTab === 'overview' ? 'btn-primary' : ''}`}
                                style={activeTab !== 'overview' ? { background: 'transparent', border: '1px solid var(--border-color)' } : {}}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab('tax')}
                                className={`btn ${activeTab === 'tax' ? 'btn-primary' : ''}`}
                                style={activeTab !== 'tax' ? { background: 'transparent', border: '1px solid var(--border-color)' } : {}}
                            >
                                Tax Report
                            </button>
                        </div>

                        {/* Strategy Selector */}
                        <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label htmlFor="tax-strategy" style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Tax Strategy:</label>
                            <select
                                id="tax-strategy"
                                value={taxStrategy}
                                onChange={(e) => handleStrategyChange(e.target.value)}
                                style={{
                                    background: 'var(--color-bg)',
                                    color: 'var(--color-text)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '4px',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.9rem'
                                }}
                            >
                                <option value="FIFO">FIFO (First-In, First-Out)</option>
                                <option value="LIFO">LIFO (Last-In, First-Out)</option>
                                <option value="HIFO">HIFO (Highest-In, First-Out)</option>
                            </select>
                        </div>
                    </div>

                    {activeTab === 'overview' ? (
                        <>
                            <Dashboard
                                gainsLosses={results.gainsLosses}
                                annualizedReturn={results.annualizedReturn}
                                source={results.source}
                            />

                            {results.gainsLosses.optionResults?.strategySummary && (
                                <OptionsBreakdown
                                    strategyData={results.gainsLosses.optionResults.strategySummary}
                                    winRate={results.gainsLosses.optionResults.winRate || 0}
                                />
                            )}

                            <div className="mt-lg">
                                <TransactionTable
                                    transactions={results.transactions}
                                    trades={results.gainsLosses.allTrades}
                                />
                            </div>
                        </>
                    ) : (
                        <TaxReport trades={results.gainsLosses.allTrades} />
                    )}

                    <div className="text-center mt-lg">
                        <button
                            className="btn btn-primary"
                            onClick={() => setResults(null)}
                        >
                            Upload New File
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
