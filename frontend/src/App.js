import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TransactionDetailPage from './pages/TransactionDetailPage';

import Dashboard from './pages/Dashboard';

const App = () => {
  return (
    <div className="App" style={{ backgroundColor: '#20232A', minHeight: '100vh', paddingBottom: '50px' }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transaction/:ticker/:filingId/:filingDate" element={<TransactionDetailPage />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;