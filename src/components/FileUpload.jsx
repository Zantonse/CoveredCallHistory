import { useRef } from 'react';

function FileUpload({ onFileUpload, loading, error }) {
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileUpload(file);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        const file = e.dataTransfer.files?.[0];
        if (file && file.name.endsWith('.csv')) {
            onFileUpload(file);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('drag-over');
    };

    return (
        <div className="card fade-in">
            <div
                className="upload-zone"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                {loading ? (
                    <div>
                        <div className="spinner mb-md"></div>
                        <p style={{ color: 'var(--color-text-muted)' }}>Processing CSV...</p>
                    </div>
                ) : (
                    <>
                        <svg
                            width="64"
                            height="64"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ margin: '0 auto 1rem', color: 'var(--color-accent)' }}
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>

                        <h3 style={{ marginBottom: '0.5rem' }}>Upload CSV File</h3>
                        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                            Drag and drop or click to browse
                        </p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                            Supports Fidelity & Charles Schwab formats
                        </p>
                    </>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            {error && (
                <div
                    className="mt-md"
                    style={{
                        padding: '1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        color: 'var(--color-danger)'
                    }}
                >
                    <strong>Error:</strong> {error}
                </div>
            )}
        </div>
    );
}

export default FileUpload;
