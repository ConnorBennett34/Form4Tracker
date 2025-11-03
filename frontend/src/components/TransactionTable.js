import React from 'react';
import TransactionRow from './TransactionRow';

const TransactionTable = ({ transactions, currentPage, totalPages, onPageChange }) => {
    const tableHeaderStyle = {
        padding: '12px 15px',
        textAlign: 'left',
        borderBottom: '1px solid #444',
        color: '#B0B0B0',
        fontWeight: 'bold'
    };

    return (
        <div style={{
            backgroundColor: '#2F333C',
            borderRadius: '8px',
            padding: '20px',
            color: 'white'
        }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Recent Transactions</h2>
            <p style={{ color: '#B0B0B0', marginBottom: '15px' }}>Latest insider trading activity from Form 4 filings</p>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                <thead>
                <tr>
                    <th style={tableHeaderStyle}>Type</th>
                    <th style={tableHeaderStyle}>Ticker</th>
                    <th style={tableHeaderStyle}>Shares</th>
                    <th style={tableHeaderStyle}>Price</th>
                    <th style={tableHeaderStyle}>Filing Date</th>
                </tr>
                </thead>
                <tbody>
                {transactions.length > 0 ? (
                    transactions.map(tx => (
                        <TransactionRow key={tx.id} transaction={tx} />
                    ))
                ) : (
                    <tr>
                        <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#B0B0B0' }}>
                            No transactions found for the selected filter.
                        </td>
                    </tr>
                )}
                </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '20px',
                    borderTop: '1px solid #3A3E46',
                    paddingTop: '15px'
                }}>
                    <p style={{ fontSize: '0.9rem', color: '#B0B0B0' }}>
                        Page {currentPage} of {totalPages}
                    </p>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            style={{
                                padding: '8px 15px',
                                backgroundColor: currentPage === 1 ? '#3A3E46' : '#55606A',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                transition: 'background-color 0.3s'
                            }}
                        >
                            Previous Page
                        </button>
                        <button
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            style={{
                                padding: '8px 15px',
                                backgroundColor: currentPage === totalPages ? '#3A3E46' : '#55606A',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                transition: 'background-color 0.3s'
                            }}
                        >
                            Next Page
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionTable;