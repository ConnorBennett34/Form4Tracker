import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

// Mock data
const mockStockData = [
    { name: 'Jan 1', price: 150.00 },
    { name: 'Feb 1', price: 155.50 },
    { name: 'Mar 1', price: 160.25 },
    { name: 'Apr 1', price: 175.80 },
    { name: 'May 1', price: 180.10 },
    { name: 'Jun 1', price: 178.50 },
    { name: 'Jul 1', price: 185.90 },
    { name: 'Aug 1', price: 195.00 },
    { name: 'Sep 1', price: 205.30 },
    { name: 'Oct 1', price: 198.75 },
    { name: 'Nov 1', price: 210.00 },
    { name: 'Dec 1', price: 220.50 },
];

const StockChart = ({ data = mockStockData }) => {
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="p-3 bg-gray-700/90 rounded shadow-md text-white border border-gray-600">
                    <p className="font-bold">{label}</p>
                    <p className="text-green-400">{`Price: $${payload[0].value.toFixed(2)}`}</p>
                </div>
            );
        }
        return null;
    };
    
    const formatYAxis = (tickItem) => `$${tickItem.toFixed(2)}`;

    return (
        <ResponsiveContainer width="100%" height={350}>
            <LineChart
                data={data}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
                {/* Grid lines for better readability */}
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                
                {/* X-Axis: Shows the time/date (name property) */}
                <XAxis dataKey="name" stroke="#A0AEC0" padding={{ left: 10, right: 10 }} />
                
                {/* Y-Axis: Shows the price movement (price property) */}
                <YAxis
                    stroke="#A0AEC0"
                    tickFormatter={formatYAxis}
                    domain={['dataMin - 10', 'dataMax + 10']}
                />
                
                {/* Custom Tooltip */}
                <Tooltip content={<CustomTooltip />} />
                
                {/* Legend (optional) */}
                <Legend iconType="square" wrapperStyle={{ paddingTop: '10px' }}/>
                
                {/* The main line showing the price data */}
                <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#38C172"
                    strokeWidth={2}
                    activeDot={{ r: 8, fill: '#38C172', stroke: '#fff', strokeWidth: 2 }}
                    name="Stock Price"
                />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default StockChart;
