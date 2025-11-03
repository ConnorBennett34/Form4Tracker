import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CHART_COLORS = ['#38C172', '#E3342F'];

const pricePoints = [
    { label: 'Filing', dateKey: 'filing_date', priceKey: 'price' },
    { label: 'Day 1', dateKey: 'day1date', priceKey: 'day1price' },
    { label: 'Day 2', dateKey: 'day2date', priceKey: 'day2price' },
    { label: 'Day 3', dateKey: 'day3date', priceKey: 'day3price' },
    { label: 'Week 1', dateKey: 'week1date', priceKey: 'week1price' },
    { label: 'Week 2', dateKey: 'week2date', priceKey: 'week2price' },
    { label: 'Week 3', dateKey: 'week3date', priceKey: 'week3price' },
    { label: 'Month 1', dateKey: 'month1date', priceKey: 'month1price' },
    { label: 'Month 3', dateKey: 'month3date', priceKey: 'month3price' },
    { label: 'Month 6', dateKey: 'month6date', priceKey: 'month6price' },
    { label: 'Year 1', dateKey: 'year1date', priceKey: 'year1price' },
];

const PerformancePieChart = ({ transactions, type }) => {
    let latestComparisonLabel = 'N/A';

    const favorableCount = transactions.filter(transaction => {
        const filingPrice = parseFloat(transaction.price);
        let comparisonPrice = 0;
        let foundPriceLabel = '';
        
        for (let i = pricePoints.length - 1; i >= 0; i--) {
            const currentPrice = parseFloat(transaction[pricePoints[i].priceKey]);
            
            if (!isNaN(currentPrice) && currentPrice > 0) {
                comparisonPrice = currentPrice;
                foundPriceLabel = pricePoints[i].label;
                break;
            }
        }
        
        if (foundPriceLabel) {
            latestComparisonLabel = foundPriceLabel;
        }

        if (isNaN(filingPrice) || filingPrice <= 0 || comparisonPrice === 0) {
            return false; 
        }

        if (type === 'purchase') {
            return comparisonPrice > filingPrice;
        } else if (type === 'sale') {
            return comparisonPrice < filingPrice;
        }
        return false;
    }).length;

    const totalTransactions = transactions.length;
    const unfavorableCount = totalTransactions - favorableCount;
    
    const totalAnalyzed = favorableCount + unfavorableCount;

    let title = '';
    let chartData = [];

    if (type === 'purchase') {
        title = 'Purchases';
        chartData = [
            { name: 'Price Up Over Time', value: favorableCount, color: CHART_COLORS[0] },
            { name: 'Price Down Over Time', value: unfavorableCount, color: CHART_COLORS[1] }
        ];
    } else if (type === 'sale') {
        title = 'Sales';
        chartData = [
            { name: 'Price Down Over Time', value: favorableCount, color: CHART_COLORS[0] },
            { name: 'Price Up Over Time', value: unfavorableCount, color: CHART_COLORS[1] }
        ];
    }
    
    if (totalAnalyzed === 0) {
        return (
            <div style={{ padding: '20px', backgroundColor: '#2F333C', borderRadius: '8px', width: '48%' }}>
                <h3 style={{ color: 'white', marginBottom: '15px', fontSize: '1.25rem' }}>{title} Performance</h3>
                <p style={{ color: '#B0B0B0', textAlign: 'center', paddingTop: '80px', paddingBottom: '80px' }}>No {title.toLowerCase()} to analyze.</p>
            </div>
        );
    }
    
    const legendItems = chartData.map(item => ({
        value: `${item.name}: ${item.value} (${((item.value / totalAnalyzed) * 100).toFixed(1)}%)`,
        type: 'square',
        id: item.name,
        color: item.color
    }));

    return (
        <div style={{ padding: '20px', backgroundColor: '#2F333C', borderRadius: '8px', width: '48%' }}>
            <h3 style={{ color: 'white', marginBottom: '15px', fontSize: '1.25rem' }}>{title} Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        labelLine={false}
                        // Label shows percentage outside the slice
                        label={({ name, percent }) => `${(percent * 100).toFixed(1)}%`}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Legend
                        layout="vertical"
                        verticalAlign="bottom"
                        align="right"
                        payload={legendItems}
                        wrapperStyle={{ color: 'white', fontSize: '14px', paddingLeft: '20px' }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export default PerformancePieChart;
