import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TransactionRow = ({ transaction }) => {
    const navigate = useNavigate();

    const [isHovered, setIsHovered] = useState(false);

    // Handling date formatting
    const transactionDate = new Date(transaction.filing_date);
    // Use an options object for reliable date string formatting
    const transactionDateString = transactionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });

    const ticker = transaction.ticker || 'N/A';
    const filingId = transaction.filing_id || 'N/A';
    const filingDate = transaction.filing_date || 'N/A';
    const shares = transaction.shares || 0;
    const price = transaction.price || 'N/A';
    const code = transaction.transaction_code || 'N/A';

    const rowStyle = {
        transition: 'background-color 0.3s',
        cursor: 'pointer',
        backgroundColor: isHovered ? '#3A3E46' : 'transparent'
    };
    
    const typeTagStyle = {
        padding: '4px 8px',
        borderRadius: '4px',
        fontWeight: 'bold',
        fontSize: '12px',
        display: 'inline-block',
        backgroundColor: transaction.transaction_code === 'S' ? '#E3342F' : '#38C172',
        color: 'white',
    };

    const cellStyle = {
        padding: '12px 15px',
        borderBottom: '1px solid #3A3E46',
        textAlign: 'left',
        color: 'white'
    };

    const handleRowClick = () => {
        const path = `/transaction/${ticker}/${filingId}/${filingDate}`;
        // The path will need to be handled by the router outside this component
        navigate(path); 
    };

    return (
        <tr
            style={rowStyle}
            onClick={handleRowClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="hover:bg-gray-700"
        >
        <td style={cellStyle}>
            <span style={typeTagStyle}>
                {code === 'S' ? '⬇️ Sale' : '⬆️ Purchase'}
            </span>
        </td>
        <td style={cellStyle}>{ticker}</td>
        <td style={cellStyle}>{shares.toLocaleString()}</td>
        <td style={cellStyle}>${!isNaN(parseFloat(price)) ? parseFloat(price).toFixed(2) : price}</td>
        <td style={cellStyle}>{transactionDateString}</td>
        </tr>
    );
};

export default TransactionRow;