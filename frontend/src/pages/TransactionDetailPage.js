import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/Header';
import StockChart from '../components/StockChart';

const TransactionDetailPage = () => {
    const params = useParams();
    const { ticker, filingId, filingDate } = params;

    const [loading, setLoading] = useState(true);
    // State to hold the fetched data
    const [transactionData, setTransactionData] = useState(null);
    
    // State to hold any potential page-level fetch error (optional, but good practice)
    const [fetchError, setFetchError] = useState(null); 

    useEffect(() => {
        const loadTransactionDetails = async () => {
            const apiUrl = `/api/transaction-details/${ticker}/${filingId}/${filingDate}`;

            try {
                const response = await fetch(apiUrl, {
                    method: 'GET',
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}. Message: ${errorText}`);
                }

                const data = await response.json();
                
                setTransactionData(data.transaction); 
                setFetchError(null);
            } catch (error) {
                setFetchError(`Loading Transaction Details failed: ${error.message}`);
                setTransactionData(null);
            } finally {
                setLoading(false);
            }
        }

        loadTransactionDetails();
    }, [ticker, filingId, filingDate]);

    const transactionDetailsPageStyles = {
        backgroundColor: 'rgb(47, 51, 60)',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '40px',
        color: 'white',
        marginTop: '3%',
        marginRight: '5%',
        marginLeft: '5%',
    };

    const backButtonStyles = {
        display: 'block',
        margin: '0 auto',
        numberOfLines: '1',
        color: 'white',
        textDecoration: 'none',
    };

    const detailsDivStyles = {
        backgroundColor: 'rgb(47, 51, 60)',
        borderRadius: '8px',
        color: 'white',
        marginRight: '1%',
        marginLeft: '1%',

    };

    return (
        <div>
            <Header />
            <div style={transactionDetailsPageStyles}>
                <Link to="/" style={backButtonStyles}>
                    ← Back to Dashboard
                </Link>

                {/* Transaction Details Section */}
                <div style={detailsDivStyles}>
                    <h1 className="text-3xl font-bold mb-2 text-gray-800">
                        Transaction Details:
                    </h1>
                    <h3>
                        {ticker} - {transactionData ? transactionData.transaction_code === "S" ? "Sale" : "Buy" : null}
                    </h3>
                    <p className="text-gray-600 mb-6">Filing ID: <span className="font-mono">{filingId}</span></p>

                    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
                        {loading ? (
                            <p className="text-lg text-gray-700">Loading details...</p>
                        ) : fetchError ? ( // Show fetch error if present
                            <p className="text-red-500">{fetchError}</p>
                        ) : transactionData ? (
                            <>
                                <div className="mb-4 text-gray-700">
                                    <h3 className="text-xl font-semibold">Date</h3>
                                    <p className="text-lg">{transactionData.filing_date}</p>
                                </div>

                                <div className="mb-4 text-gray-700">
                                    <h3 className="text-xl font-semibold">Filing Accession Number</h3>
                                    <p className="text-lg break-all">{transactionData.filing_id}</p>
                                </div>
                            </>
                        ) : (
                            <p className="text-red-500">Transaction details could not be loaded.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Stock Price Movement / Chart Section */}
            <div style={{
                backgroundColor: '#2F333C',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '40px',
                marginRight: '5%',
                marginLeft: '5%',
                color: 'white'
            }}>
                <div style={{marginRight: '1%', marginLeft: '1%'}}>
                    <h2>Stock Price Movement</h2>
                    <p>Transaction prices over different time periods</p>

                    <div style={{ height: '350px', border: '1px solid #444', marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <StockChart transactionData={transactionData} isLoading={loading} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailPage;