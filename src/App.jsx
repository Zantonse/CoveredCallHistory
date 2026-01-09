import { useState } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import TransactionTable from './components/TransactionTable';
import OptionsBreakdown from './components/OptionsBreakdown';
import TaxReport from './components/TaxReport';
import { parseCSV } from './utils/csvParser';
import { calculateGainsLosses } from './utils/gainsCalculator';
import { calculateXIRR } from './utils/annualizedReturn';

import TaxReport from './components/TaxReport';
// ... imports

function App() {
    // ... existing state
    const [taxStrategy, setTaxStrategy] = useState('FIFO');
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'tax'

    // ... handlers

    return (
        <div className="container">
            {/* Header ... */}

            {!results && (/* FileUpload */)}

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
