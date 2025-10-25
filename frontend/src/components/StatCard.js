// frontend/src/components/StatCard.js

import React from 'react';
import { useState, useEffect } from 'react';

const StatCard = ({ title, value, color, isPurchase, isSale }) => {
    const [isHovered, setIsHovered] = useState(false);

    const iconStyle = {
        color: isPurchase ? '#38C172' : isSale ? '#E3342F' : 'white',
        fontSize: '28px',
    };

    const statCardStyle = {
        backgroundColor: isHovered ? 'transparent': '#3A3E46',
        flex: 1,
        borderRadius: '8px',
        padding: '20px',
        color: 'white',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    };

    return (
        <div style={statCardStyle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div>
                <p style={{ margin: 0, fontSize: '14px', color: '#B0B0B0' }}>{title}</p>
                <h2 style={{ margin: '5px 0 0 0', fontSize: '32px', color: color }}>
                    {value}
                </h2>
            </div>

            {/* Icon based on type */}
            {isPurchase && <span style={iconStyle}>⬆️</span>}
            {isSale && <span style={iconStyle}>⬇️</span>}
            {!isPurchase && !isSale && <span style={iconStyle}>📊</span>}
        </div>
    );
};

export default StatCard;