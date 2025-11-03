import React, { useState, useEffect } from 'react';
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

const buyStroke = "#38C172";
const sellStroke = "#E3342F";
const flatStroke = "#A0AEC0";

const StockChart = ({ transactionData, isLoading }) => {
    const [chartError, setChartError] = useState(null);
    const [stockData, setStockData] = useState([]);
    const [lineSegments, setLineSegments] = useState([]);

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

    const chartErrorStyle = {
        textAlign: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        display: 'flex',
        height: '100%',
    };

    useEffect(() => {
        if (isLoading || !transactionData || Object.keys(transactionData).length === 0) {
            setStockData([]);
            setLineSegments([]);
            return;
        }

        const rawStockData = pricePoints.map(point => {
            const date = transactionData[point.dateKey];
            const rawPrice = transactionData[point.priceKey];
            const price = parseFloat(rawPrice);

            const isValid = (date && rawPrice !== null && !isNaN(price) && price > 0.00);

            if (isValid) {
                return {
                    name: point.label,
                    price: price,
                    fullDate: date
                };
            }
            return null;
        });

        const filteredStockData = rawStockData.filter(dataPoint => dataPoint !== null);

        if (filteredStockData.length < 2) {
            setChartError("Need at least two pricing data points to plot a line movement chart.");
            setStockData([]);
            setLineSegments([]);
        } else {
            setChartError(null);
            setStockData(filteredStockData);
            
            const segments = [];
            for (let i = 0; i < filteredStockData.length - 1; i++) {
                const startPoint = filteredStockData[i];
                const endPoint = filteredStockData[i + 1];

                let strokeColor;
                if (endPoint.price > startPoint.price) {
                    strokeColor = buyStroke;
                } else if (endPoint.price < startPoint.price) {
                    strokeColor = sellStroke;
                } else {
                    strokeColor = flatStroke;
                }

                segments.push({
                    key: `segment-${i}`,
                    stroke: strokeColor,
                    data: [startPoint, endPoint]
                });
            }
            setLineSegments(segments);
        }

    }, [transactionData, isLoading]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const dataPoint = stockData.find(d => d.name === label);
            
            if (!dataPoint) return null;

            const priceValue = payload[0].value; 

            return (
                <div className="p-3 bg-gray-700/90 rounded shadow-md text-white border border-gray-600">
                    <p className="font-bold">{label}</p>
                    <p className="text-sm text-gray-400">{dataPoint.fullDate}</p>
                    <p className="text-green-400">{`Price: $${priceValue.toFixed(2)}`}</p>
                </div>
            );
        }
        return null;
    };
    
    const formatYAxis = (tickItem) => `$${tickItem.toFixed(2)}`;

    const allPrices = stockData.map(d => d.price);
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
    const padding = (maxPrice - minPrice) * 0.1 || 5;

    const activeDotColor = "#ffffffff";

    return (
        <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
            {isLoading ? (
                <div className="text-center p-8 text-gray-400">Loading chart data...</div>
            ) : chartError ? (
                <div className="text-center p-8 text-gray-400" style={chartErrorStyle}>{chartError}</div>
            ) : stockData.length >= 2 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={stockData}
                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        
                        <XAxis
                            dataKey="name"
                            stroke="#A0AEC0"
                            padding={{ left: 10, right: 10 }}
                            scale="point"
                            allowDuplicatedCategory={false}
                        />
                        
                        <YAxis
                            stroke="#A0AEC0"
                            tickFormatter={formatYAxis}
                            domain={[minPrice - padding, maxPrice + padding]}
                        />
                        
                        <Tooltip content={<CustomTooltip />} />

                        <Line
                            type="linear"
                            dataKey="price"
                            stroke="transparent"
                            strokeWidth={0}
                            dot={{ r: 4, fill: '#fff', stroke: activeDotColor, strokeWidth: 2 }}
                            activeDot={{ r: 8, fill: '#fff', stroke: activeDotColor, strokeWidth: 2 }}
                            name="Stock Price"
                        />

                        {lineSegments.map(segment => (
                            <Line
                                key={segment.key}
                                type="linear"
                                data={segment.data}
                                dataKey="price"
                                stroke={segment.stroke}
                                strokeWidth={4}
                                dot={false}
                                legendType="none"
                                activeDot={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <div className="text-center p-8 text-gray-400">No chart data available.</div>
            )}
        </div>
    );
};

export default StockChart;
