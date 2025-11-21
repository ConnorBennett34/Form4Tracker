import React, { use } from 'react';
// import StyleSheet from 'react';
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import TransactionTable from '../components/TransactionTable';
import PerformancePieChart from '../components/PerformancePieChart';
import API_IP_AddressVariable from '../assets/tools/API_IP_AddressVariable';
import API_IP_Port from '../assets/tools/API_IP_Port';

const API_IP_Address_Var = API_IP_AddressVariable();
const API_IP_Port_Var = API_IP_Port();

const fetchFilings = async (temp_API_URL) => {
    try {
        const response = await fetch(temp_API_URL, {
            method: 'GET',
        });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}. Message: ${errorText}`);
    }

    const data = await response.json();
    return data.filings;

    } catch (error) {
        console.error('Error during filings fetching:', error.message);
        return [];
    }
}

const TRANSACTIONS_PER_PAGE = 25;

const Dashboard = () => {
    const [transactions, setTransactions] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [sales, setSales] = useState([]);

    const [filteredTransactionsType, setFilteredTransactionsType] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const statCardContainer = {
        cursor: 'pointer',
        width: '30%',
        justifyContent: 'space-between',
    };

    useEffect(() => {
        const loadFilings = async () => {
            let temp_API_URL = '/api/get-recent-filings';

            try{
                const filings = await fetchFilings(temp_API_URL);
                setTransactions(filings);

                const tempPurchases = filings.filter(f => f.transaction_code === 'P');
                const tempSales = filings.filter(f => f.transaction_code === 'S');

                setPurchases(tempPurchases);
                setSales(tempSales);
            }
            catch(error){
                console.log("Error loading filings: ", error);
            }
        }

        loadFilings();
    }, []);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [filteredTransactionsType]);

    const handleStatCardClick = (stat) => {
        setFilteredTransactionsType(stat.id === 'total' ? '' : stat.id);
    };

    const allTransactionsToShow = (() => {
        switch (filteredTransactionsType) {
            case 'buys':
                return purchases;
            case 'sales':
                return sales;
            case '':
            default:
                return transactions;
        }
    })();
    
    const totalTransactions = allTransactionsToShow.length;
    const totalPages = Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE);

    const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
    const endIndex = startIndex + TRANSACTIONS_PER_PAGE;
    const currentTransactions = allTransactionsToShow.slice(startIndex, endIndex);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const stats = [
        { title: 'Total Buys', value: purchases.length, id: 'buys', isPurchase: true, isSale: false },
        { title: 'Total Sells', value: sales.length, id: 'sales', isPurchase: false, isSale: true },
        { title: 'Total Trades', value: transactions.length, id: 'total', isPurchase: false, isSale: false},
    ];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#1E2024' }}>
            {/* Top Navigation / Title */}
            <Header />

            <div style={{ padding: '20px 50px' }}>
            
            {/* Stat Cards Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '40px' }}>
            {(stats && stats.length > 0) ?
                stats.map((stat) => (
                    <div
                    key={stat.title}
                    onClick={() => handleStatCardClick(stat)}
                    style={statCardContainer}
                    >
                        {/* Highlights the active card */}
                        <StatCard
                            {...stat}
                            isActive={filteredTransactionsType === stat.id || (filteredTransactionsType === '' && stat.id === 'total')}
                        />
                    </div>
                    ))
                :
                <div></div>
            }
            </div>

            {/* Pie Chart Section */}
            <div style={{ minHeight: '10vh', display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '40px' }}>
                    <PerformancePieChart transactions={transactions} type={'purchase'}/>
                
                    <PerformancePieChart transactions={transactions} type={'sale'}/>
            </div>
            {/* Recent Transactions Table (Now paginated) */}
            <TransactionTable
                transactions={currentTransactions}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />
        </div>
        </div>
    );
};

export default Dashboard;