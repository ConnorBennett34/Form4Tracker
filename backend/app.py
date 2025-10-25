import requests
import time
import os
import re
from datetime import datetime, timedelta
from flask import Flask, jsonify
from supabase import create_client, Client
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from flask_cors import CORS

# ----------------------------------------
# 1. INITIALIZATION & CONFIG
# ----------------------------------------

load_dotenv()

app = Flask(__name__)

CORS(app)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SEC_USER_AGENT = os.environ.get("SEC_USER_AGENT")

RATE_LIMIT_DELAY_MS = 150

# ----------------------------------------
# 2. UTILITY FUNCTIONS
# ----------------------------------------

def delay(ms: int):
    """Wait for a specified number of milliseconds."""
    time.sleep(ms / 1000)

def get_quarter(date: datetime) -> int:
    """Determine the quarter (1-4) for a given date."""
    return (date.month - 1) // 3 + 1

def format_date(date: datetime) -> str:
    """Format date to YYYYMMDD string for SEC index URLs."""
    return date.strftime('%Y%m%d')

def sec_fetch(url: str, content_type: str = 'text/plain') -> requests.Response | None:
    """Handles fetching from SEC with rate limiting and user agent."""
    delay(RATE_LIMIT_DELAY_MS)
    try:
        headers = {
            'User-Agent': SEC_USER_AGENT,
            'Accept': content_type,
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response
    except requests.exceptions.HTTPError as e:
        if e.response.status_code != 404:
            print(f"HTTP Error fetching {url}: {e.response.status_code}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Request Error fetching {url}: {e}")
        return None

def get_ticker_from_cik(cik: str) -> str:
    """Fetch the primary ticker symbol for a given CIK."""
    padded_cik = cik.zfill(10)
    url = f"https://data.sec.gov/submissions/CIK{padded_cik}.json"
    
    response = sec_fetch(url, content_type='application/json')
    
    if response:
        try:
            data = response.json()
            return data.get('tickers', [None])[0] or 'UNKNOWN'
        except Exception as e:
            return 'UNKNOWN'
    return 'UNKNOWN'

def fetch_daily_index(date: datetime) -> str | None:
    """Fetch the daily master index file from SEC EDGAR."""
    year = date.year
    quarter = get_quarter(date)
    date_str = format_date(date)
    
    url = f"https://www.sec.gov/Archives/edgar/daily-index/{year}/QTR{quarter}/master.{date_str}.idx"
        
    response = sec_fetch(url, content_type='text/plain')
    return response.text if response else None

def parse_daily_index(index_text: str) -> list[dict]:
    """Parse the daily master index text to extract Form 4 filings."""
    filings = []
    lines = index_text.split('\n')
    data_started = False
    
    for line in lines:
        if '---' in line:
            data_started = True
            continue
        
        if not data_started or not line.strip():
            continue
        
        parts = [part.strip() for part in line.split('|')]
        
        if len(parts) >= 5 and parts[2] == '4':
            filename_parts = parts[4].split('/')
            accession_number = filename_parts[-1].replace('.txt', '')
            
            filings.append({
                'cik': parts[0],
                'companyName': parts[1],
                'formType': parts[2],
                'filingDate': parts[3],
                'accessionNumber': accession_number,
            })
            
    return filings

def parse_form4_xml(xml_text: str) -> list[dict]:
    """Simple regex parsing of the Form 4 XML text to extract non-derivative and derivative transactions."""
    transactions = []
    
    transaction_types = {
        'nonDerivativeTransaction': r'<transactionPricePerShare>[\s\S]*?<value>(.*?)</value>',
        'derivativeTransaction': r'<conversionOrExercisePrice>[\s\S]*?<value>(.*?)</value>'
    }
    
    for tag, price_tag_re in transaction_types.items():
        matches = re.findall(rf'<{tag}>([\s\S]*?)<\/{tag}>', xml_text)
        
        for transaction_xml in matches:
            code_match = re.search(r'<transactionCode>(.*?)</transactionCode>', transaction_xml)
            shares_match = re.search(r'<transactionShares>[\s\S]*?<value>(.*?)</value>', transaction_xml)
            price_match = re.search(price_tag_re, transaction_xml)

            if code_match and shares_match:
                try:
                    shares = float(shares_match.group(1))
                    
                    price = 0.0
                    if price_match:
                        price = float(price_match.group(1))

                    transactions.append({
                        'transactionCode': code_match.group(1),
                        'shares': shares,
                        'pricePerShare': price,
                    })
                except ValueError:
                    continue
                    
    return transactions

def fetch_form4_filing(cik: str, accession_number: str) -> list[dict]:
    """Fetch the actual Form 4 document and parse transactions."""
    accession_no_no_dashes = accession_number.replace('-', '')
    url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no_no_dashes}/{accession_number}.txt"
        
    response = sec_fetch(url, content_type='text/plain, application/xml, */*')
    
    if response:
        return parse_form4_xml(response.text)
    
    return []

def check_observation_dates():
    """
    Checks the 'transactions' table for any transactions whose future
    observation dates match the current date.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Supabase credentials are not set.")
        return

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Failed to initialize Supabase client: {e}")
        return

    today_date_str = datetime.now().strftime('%Y-%m-%d')
    
    print(f"\nChecking for observation dates matching today: {today_date_str}")
    
    try:
        filter_str = (
            f"day1date.eq.{today_date_str},"
            f"day2date.eq.{today_date_str},"
            f"day3date.eq.{today_date_str},"
            f"week1date.eq.{today_date_str},"
            f"week2date.eq.{today_date_str},"
            f"week3date.eq.{today_date_str},"
            f"month1date.eq.{today_date_str},"
            f"month3date.eq.{today_date_str},"
            f"month6date.eq.{today_date_str},"
            f"year1date.eq.{today_date_str}"
        )
        
        response = supabase.table('transactions').select('*').or_(filter_str).execute()
        
        matched_transactions = response.data
        
        if matched_transactions:
            print(f"Found {len(matched_transactions)} transactions needing a price observation today.")

            for tx in matched_transactions:
                print(f" - READY: Ticker: {tx['ticker']}, Filing ID: {tx['filing_id']}")

            return matched_transactions
            
        else:
            print("No transactions are scheduled for observation today.")
            
    except Exception as e:
        print(f"Failed to query transactions table: {e}")

def get_transaction_details(ticker, filingId, filingDate):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Supabase credentials are not set.")
        return

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Failed to initialize Supabase client: {e}")
        return

    try:
        filter_str = (
            f"ticker.eq.{ticker},"
            f"filingId.eq.{filingId},"
            f"filingDate.eq.{filingDate},"
        )
        
        response = supabase.table('transactions').select('*').eq('ticker', ticker).eq('filing_id', filingId).eq('filing_date', filingDate).limit(1).single().execute()
        
        transaction = response.data
        
        if transaction:
            return transaction
            
        else:
            print("No transactions are scheduled for observation today.")
            
    except Exception as e:
        print(f"Failed to query transactions table: {e}")

# ----------------------------------------
# 3. FLASK ROUTES
# ----------------------------------------

@app.route('/api/scan-filings', methods=['POST'])
def scan_filings():
    """
    Scans the last few days of SEC daily index files for Form 4 insider trading reports,
    fetches the full filings, extracts purchase/sale transactions, and inserts them
    into the Supabase 'sec_transactions' table.
    """
    try:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERROR: Supabase credentials are not set.")
            return jsonify({
                'error': 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
            }), 500

        try:
            supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            print(f"Error initializing Supabase client: {e}")
            return jsonify({
                'error': f'Failed to initialize Supabase client: {str(e)}'
            }), 500
            
        total_transactions = 0
        current_date = datetime.now()
        max_days_back = 5
        form4_filings = []

        for days_back in range(max_days_back):
            target_date = current_date - timedelta(days=days_back)
            
            if target_date.weekday() in [5, 6]:
                continue
                        
            index_text = fetch_daily_index(target_date)
            if index_text:
                filings = parse_daily_index(index_text)
                form4_filings.extend(filings)
                
                if len(form4_filings) >= 50:
                    print("Reached limit of 50 filings found. Stopping index search.")
                    break
        
        filings_to_process = form4_filings[:30]
        
        for filing in filings_to_process:
            ticker = get_ticker_from_cik(filing['cik'])
            
            if ticker == 'UNKNOWN':
                continue
            
            transactions = fetch_form4_filing(filing['cik'], filing['accessionNumber'])
            
            if transactions:
                for transaction in transactions:
                    code = transaction['transactionCode']
                    if code in ['P', 'S']:
                        data_to_insert = {
                            'filing_id': filing['accessionNumber'],
                            'transaction_code': code,
                            'ticker': ticker,
                            'shares': transaction['shares'],
                            'price': transaction['pricePerShare'],
                            'filing_date': filing['filingDate'],
                        }
                        
                        try:
                            supabase.table('transactions').insert(data_to_insert).execute()
                            total_transactions += 1
                            print(f"Inserted {code} transaction for {ticker}: {transaction['shares']} shares @ ${transaction['pricePerShare']} (Filing: {filing['accessionNumber']})")

                        except Exception as db_error:
                            error_message = str(db_error)
                            
                            if 'duplicate key value violates unique constraint' in error_message or '23505' in error_message:
                                print(f'Transaction already exists for {ticker} (Filing: {filing["accessionNumber"]}). Skipping.')
                            else:
                                print(f'Error inserting transaction: {error_message}')

        return jsonify({
            'success': True,
            'message': f"Scanned {len(filings_to_process)} SEC Form 4 filings and inserted {total_transactions} transactions",
            'transactionsInserted': total_transactions,
            'filingsProcessed': len(filings_to_process),
        }), 200

    except Exception as error:
        print(f"Critical Error in scan-filings function: {error}")
        return jsonify({
            'error': str(error),
            'success': False
        }), 500
    
@app.route('/api/get-recent-filings', methods=['GET'])
def get_recent_filings():
    """
    Gets the latest filings from the Supabase database (transactions table).
    """
    try:
        if not SUPABASE_URL or not SUPABASE_KEY:
            return jsonify({
                'error': 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
            }), 500

        try:
            supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            return jsonify({
                'error': f'Failed to initialize Supabase client: {str(e)}'
            }), 500

        response = supabase.table('transactions').select('*').order(
            'filing_date', desc=True
        ).order(
            'created_at', desc=True
        ).limit(100).execute()

        data = response.data
        
        return jsonify({
            'success': True,
            'filings': data
        }), 200

    except Exception as error:
        print(f"Critical Error in get-filings function: {error}")
        return jsonify({
            'error': str(error),
            'success': False,
            'message': 'Failed to retrieve data from Supabase.'
        }), 500
    
@app.route('/api/check-dates', methods=['GET'])
def check_dates():
    """
    Gets the transactions which have a date that matches the current
    date and the price needs to be checked and filled in
    """
    try:
        transactions = check_observation_dates()
        
        return jsonify({
            'success': True,
            'transactions': transactions
        }), 200

    except Exception as error:
        print(f"Critical Error in check-dates function: {error}")

@app.route('/api/transaction-details/<ticker>/<filingId>/<filingDate>', methods=['GET'])
def transaction_details(ticker, filingId, filingDate):
    try:
        transaction = get_transaction_details(ticker, filingId, filingDate)
        
        return jsonify({
            'success': True,
            'transaction': transaction
        }), 200

    except Exception as error:
        print(f"Critical Error in transaction-details function: {error}")

if __name__ == '__main__':
    scheduler = BackgroundScheduler()

    scheduler.add_job(
        func=check_observation_dates,
        trigger='cron',
        hour=1,
        minute=0,
        timezone='UTC',
        id='daily_observation_check'
    )
    
    scheduler.start()
    print("Scheduler started: Daily observation date check set for 01:00 UTC.")

    app.run(debug=True, port=5000, use_reloader=False)
