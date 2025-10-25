import React from 'react';
import TransactionRow from './TransactionRow';

const TransactionTable = ({ transactions }) => {
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
            <h2>Recent Transactions</h2>
            <p>Latest insider trading activity from Form 4 filings</p>

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
                {/* Map through data and render a row for each transaction */}
                {transactions.map(tx => (
                    <TransactionRow key={tx.id} transaction={tx} />
                ))}
                {/* Truncated for brevity; the full list would be here */}
                </tbody>
            </table>
        </div>
    );
};

export default TransactionTable;