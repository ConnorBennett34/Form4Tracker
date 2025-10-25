import React, { use } from 'react';
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import TransactionTable from '../components/TransactionTable';
import API_IP_AddressVariable from '../assets/tools/API_IP_AddressVariable';
import API_IP_Port from '../assets/tools/API_IP_Port';

const API_IP_Address_Var = API_IP_AddressVariable();
const API_IP_Port_Var = API_IP_Port();

const SERVER_URL = `http://${API_IP_Address_Var}:${API_IP_Port_Var}`;

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
        alert(`Error fetching filings: ${error.message}`);
    }
}

const Dashboard = () => {
    const [transactions, setTransactions] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [sales, setSales] = useState([]);

    useEffect(() => {
        const loadFilings = async () => {

            let temp_API_URL = SERVER_URL + '/api/get-recent-filings';

            const filings = await fetchFilings(temp_API_URL);
            setTransactions(filings);

            var tempPurchases = [];
            var tempSales = [];

            for(let i = 0; i < filings.length; i++){
                if(filings[i].transaction_code === 'P'){
                    tempPurchases.push(filings[i]);
                }
                else if(filings[i].transaction_code === 'S'){
                    tempSales.push(filings[i]);
                }
            }

            setPurchases(tempPurchases);
            setSales(tempSales);
        }

        loadFilings();
    }, []);

    const stats = [
        { title: 'Total Buys', value: purchases.length, id: 'buys', isPurchase: true, isSale: false },
        { title: 'Total Sells', value: sales.length, id: 'sales', isPurchase: false, isSale: true },
        { title: 'Total Trades', value: transactions.length, id: 'total', isPurchase: false, isSale: false},
    ];

    return (
        <div>
            {/* Top Navigation / Title */}
            <Header />

            <div style={{ padding: '20px 50px' }}>
            
            {/* Stat Cards Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '40px' }}>
            {(stats && stats.length > 0) ?
                stats.map((stat) => (
                    <StatCard key={stat.title} {...stat}/>
                ))
                :
                <div></div>
            }
            </div>

            {/* Recent Transactions Table */}
            <TransactionTable transactions={transactions}/>
        </div>
        </div>
    );
};

export default Dashboard;