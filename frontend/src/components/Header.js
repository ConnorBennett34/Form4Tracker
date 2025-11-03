import React, { useState } from 'react';

const Header = () => {
    // const [isScanning, setIsScanning] = useState(false);
    // const [isChecking, setIsChecking] = useState(false);

    // const scanFilingsButtonStyle = {
    //     backgroundColor: isScanning ? '#80A8FF' : '#007BFF',
    //     maxWidth: '40%',
    //     margin: '0',
    //     color: 'white',
    //     border: 'none',
    //     padding: '10px 20px',
    //     borderRadius: '5px',
    //     cursor: isScanning ? 'not-allowed' : 'pointer',
    //     display: 'flex',
    //     alignItems: 'center',
    //     gap: '8px'
    // };

    // const buttonsContainerStyle = {
    //     width: '30%',
    //     margin: '0',
    //     display: 'flex',
    //     alignItems: 'center',
    //     justifyContent: 'space-between',
    // };

    // const handleScanFilings = async () => {
    //     if (isScanning) return;

    //     setIsScanning(true);
        
    //     const apiUrl = '/api/scan-filings';

    //     try {
    //         const response = await fetch(apiUrl, {
    //             method: 'POST',
    //             headers: {
    //             'Content-Type': 'application/json',
    //             },
    //         });

    //         if (!response.ok) {
    //             const errorText = await response.text();
    //             throw new Error(`HTTP error! status: ${response.status}. Message: ${errorText}`);
    //         }

    //         const data = await response.json();
    //         console.log('Scan initiated successfully:', data);
    //         alert('Filings scan initiated successfully!');
            
    //     } catch (error) {
    //         console.error('Error during filings scan:', error.message);
    //         alert(`Error scanning filings: ${error.message}`);
    //     } finally {
    //         setIsScanning(false);
    //     }
    // };

    // const handleCheckDates = async () => {
    //     if (isChecking) return;

    //     setIsChecking(true);

    //     const apiUrl = '/api/check-dates';

    //     try {
    //         const response = await fetch(apiUrl, {
    //             method: 'GET',
    //         });

    //         if (!response.ok) {
    //             const errorText = await response.text();
    //             throw new Error(`HTTP error! status: ${response.status}. Message: ${errorText}`);
    //         }

    //         const data = await response.json();
    //         console.log('Dates checked successfully:', data);
    //     } catch (error) {
    //         console.error('Error during dates checking:', error.message);
    //         alert(`Error dates checking: ${error.message}`);
    //     } finally {
    //         setIsChecking(false);
    //     }
    // };

    return (
        <header style={{
            backgroundColor: '#2F333C',
            padding: '20px 50px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'white',
            borderBottom: '1px solid #444'
        }}>
            <div>
                <h1 style={{ margin: 0, fontSize: '24px' }}>SEC Form 4 Tracker</h1>
                <p style={{ margin: 0, fontSize: '14px', color: '#B0B0B0' }}>Monitor insider trading activity from SEC filings</p>
            </div>
            {/* <div style={buttonsContainerStyle}>
                <button
                    style={scanFilingsButtonStyle}
                    onClick={handleCheckDates}
                    disabled={isChecking}
                >
                    {isChecking ? 'Checking...' : 'Check Dates'}
                </button>
                <button
                    style={scanFilingsButtonStyle}
                    onClick={handleScanFilings}
                    disabled={isScanning}
                >
                    {isScanning ? 'Scanning...' : 'Scan Filings'}
                </button>
            </div> */}
        </header>
    );
};

export default Header;