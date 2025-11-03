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
from polygon import RESTClient

# ----------------------------------------
# 1. INITIALIZATION & CONFIG
# ----------------------------------------

load_dotenv()

app = Flask(__name__)

CORS(app)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SEC_USER_AGENT = os.environ.get("SEC_USER_AGENT")
POLYGON_KEY = os.environ.get("POLYGON_KEY")

RATE_LIMIT_DELAY_MS = 150

PRICE_POINT_KEYS = [
    {'dateKey': 'day1date', 'priceKey': 'day1price'},
    {'dateKey': 'day2date', 'priceKey': 'day2price'},
    {'dateKey': 'day3date', 'priceKey': 'day3price'},
    {'dateKey': 'week1date', 'priceKey': 'week1price'},
    {'dateKey': 'week2date', 'priceKey': 'week2price'},
    {'dateKey': 'week3date', 'priceKey': 'week3price'},
    {'dateKey': 'month1date', 'priceKey': 'month1price'},
    {'dateKey': 'month3date', 'priceKey': 'month3price'},
    {'dateKey': 'month6date', 'priceKey': 'month6price'},
    {'dateKey': 'year1date', 'priceKey': 'year1price'},
]

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

def get_grouped_stock_data(tickers):
    """
    Fetches daily OHLCV data for ALL tickers and filters it down to a list.
    """

    if not POLYGON_KEY:
        return {"error": "API Key not loaded."}

    target_date_obj = datetime.now().date() - timedelta(days=1)
    target_date_str = str(target_date_obj)
    
    ticker_data = []
    
    print(f"Fetching grouped daily data for {target_date_str}...")

    client = None

    try:
        client = RESTClient(POLYGON_KEY)

        resp = client.get_grouped_daily_aggs(
            date=target_date_str,
            adjusted=True
        )

        ticker_map = {
            stock.ticker: stock
            for stock in resp
        }

        for ticker in tickers:
            if ticker in ticker_map:
                ticker_data.append(ticker_map[ticker])
            else:
                print(f"No data found for {ticker}")

        return ticker_data
        
    except Exception as e:
        if "rate limit" in str(e).lower():
            print("Rate limit hit. Waiting 5 seconds and retrying...")
            time.sleep(5)
            return get_grouped_stock_data()
            
        return {"error": f"An unexpected error occurred: {e}"}
        
def insertNewStockData(transactions, stock_data):
    """
    Updates the transaction price columns in the Supabase database
    based on the current stock market data.
    Returns True if all updates were successful, False otherwise.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Supabase credentials are not set.")
        return

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Failed to initialize Supabase client: {e}")
        return

    new_data = {}
    for item in stock_data:
        dt_object = datetime.fromtimestamp(item.timestamp / 1000).date()
        
        new_data[(item.ticker, dt_object)] = {
            'price': item.vwap
        }

    if not stock_data:
        print("Error: stock_data array is empty.")
        return
    
    current_date = datetime.fromtimestamp(stock_data[0].timestamp / 1000).date()
    
    DATE_TO_PRICE_COL = {
        'day1date': 'day1price',
        'day2date': 'day2price',
        'day3date': 'day3price',
        'week1date': 'week1price',
        'week2date': 'week2price',
        'week3date': 'week3price',
        'month1date': 'month1price',
        'month3date': 'month3price',
        'month6date': 'month6price',
        'year1date': 'year1price',
    }

    updates_to_perform = []
    
    for transaction in transactions:
        ticker = transaction.get('ticker')
        transaction_id = transaction.get('id')
        
        update_column = None
        
        for date_col, price_col in DATE_TO_PRICE_COL.items():
            transaction_date_str = transaction.get(date_col)
            
            if transaction_date_str:
                transaction_date_obj = datetime.strptime(transaction_date_str, '%Y-%m-%d').date()
                
                if transaction_date_obj == current_date:
                    update_column = price_col
                    break

        if update_column:
            key = (ticker, current_date)
            if key in new_data:
                new_price = new_data[key]['price']
                
                updates_to_perform.append({
                    'id': transaction_id,
                    update_column: new_price
                })
            else:
                print(f"Warning: Stock data for ticker {ticker} on {current_date} not found.")

    if not updates_to_perform:
        print("No transactions found that need updating for the current date.")
        return {
            'successful': True,
            'message': "No Transactions needed updating"
        }, 200
        
    print(f"Attempting to update {len(updates_to_perform)} transactions...\n{updates_to_perform}")

    
    try:
        success_count = 0
        for update_item in updates_to_perform:
            transaction_id = update_item['id']
            data_to_update = {k: v for k, v in update_item.items() if k != 'id'}
            
            response = (
                supabase.table("transactions")
                .update(data_to_update)
                .eq("id", transaction_id)
                .execute()
            )
            
            if not response.data or 'error' in response.data:
                print(f"Failed to update ID {transaction_id}: {response.data}")
            else:
                success_count += 1

        print(f"Successfully updated {success_count} transactions out of {len(updates_to_perform)} attempts.")
        return jsonify({
            'successful': True,
            'updates': updates_to_perform
        }), 200
        
    except Exception as e:
        print(f"Supabase update failed with an error: {e}")
        return {
            'successful': False,
            'message': f"Supabase update failed: {e}"
        }, 500
    


def get_stale_update_jobs():
    """
    Function to retrieve all transactions where any monitored date field is in the 
    past AND the corresponding price field is missing/null/zero.
    """
    print("--- 1. Identifying Stale Price Points/Update Jobs in Supabase ---")
    today_str = datetime.now().strftime('%Y-%m-%d')
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Supabase credentials are not set.")
        return

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Failed to initialize Supabase client: {e}")
        return

    response = (
        supabase.table("transactions")
        .select("*")
        .execute()
    )

    transactions = response.data

    stale_jobs = []
    
    for transaction in transactions:
        if not isinstance(transaction, dict):
            print(f"Warning: Skipping non-dictionary item: {transaction}")
            continue

        for point in PRICE_POINT_KEYS:
            date_key = point['dateKey']
            price_key = point['priceKey']
            
            target_date_str = transaction.get(date_key)
            target_price = transaction.get(price_key)

            if (target_date_str and
                target_date_str < today_str and
                (target_price is None or target_price == 0.00)):
                
                stale_jobs.append({
                    "transaction_id": transaction['id'],
                    "ticker": transaction['ticker'],
                    "target_date": target_date_str,
                    "price_point_key": price_key,
                    "date_point_key": date_key,
                    "original_transaction_data": {k: v for k, v in transaction.items() if k not in ['id', 'ticker']}
                })
                
    print(f"Identified {len(stale_jobs)} price points requiring update.")
    return stale_jobs


def get_grouped_market_data(date: str, tickers: list):
    """
    Calls the Polygon.io Grouped Daily API for a specific date and a list of tickers.
    Returns a list of GroupedDailyAgg objects.
    """
    print(f"--- 2. Fetching Polygon data for date: {date}, ticker(s): {tickers} ---")
    
    if not POLYGON_KEY:
        print("Error: Polygon API Key not set.")
        return []

    try:
        client = RESTClient(POLYGON_KEY)

        resp = client.get_grouped_daily_aggs(
            date=date,
            adjusted=True
        )

        ticker_map = {
            stock.ticker: stock
            for stock in resp
        }
        
        ticker_data = [ticker_map[ticker] for ticker in tickers if ticker in ticker_map]
        
        return ticker_data
    except Exception as e:
        print(f"Error fetching Polygon data for {date}: {e}")
        return []


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

        if transactions and len(transactions) > 0:

            tickers = []

            for transaction in transactions:
                tickers.append(transaction['ticker'])

            stock_data = get_grouped_stock_data(tickers)

            result = insertNewStockData(transactions, stock_data)
            
            return result
        
        return jsonify({
            'message': 'No stocks that have dates needing to be checked.'
        })

    except Exception as error:
        print(f"Critical Error in check-dates function: {error}")

        return jsonify({
            "status": "Internal Server Error",
            "message": f"An error occurred: {str(error)}"
        }), 500

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

@app.route('/api/check-earlier-dates', methods=['GET'])
def update_stale_transactions_api():
    """
    The main API endpoint logic. It fetches stale price points, gets market data,
    and returns the combined results for manual review/update.
    """
    all_stale_jobs = get_stale_update_jobs()
    
    if not all_stale_jobs:
        return jsonify({"status": "success", "message": "No stale price points found to update."}), 200
    
    jobs_by_date_ticker = {}

    for job in all_stale_jobs:
        date = job['target_date']
        ticker = job['ticker']
        key = (date, ticker)
        
        if date not in jobs_by_date_ticker:
            jobs_by_date_ticker[date] = {
                'tickers': set(),
                'jobs': []
            }
            
        jobs_by_date_ticker[date]['tickers'].add(ticker)
        jobs_by_date_ticker[date]['jobs'].append(job)
        
    
    all_market_data = {}
    
    unique_dates = list(jobs_by_date_ticker.keys())
    
    for date in unique_dates:
        group = jobs_by_date_ticker[date]
        tickers_to_fetch = list(group['tickers'])
        
        data = get_grouped_market_data(date, tickers_to_fetch)

        for agg_object in data:
            composite_key = f"{date}_{agg_object.ticker}" 
            all_market_data[composite_key] = agg_object.open 

    transactions_for_update = []
    
    for job in all_stale_jobs:
        date = job['target_date']
        ticker = job['ticker']
        composite_key = f"{date}_{ticker}"
        
        market_price = all_market_data.get(composite_key, None)
        
        transactions_for_update.append({
            "transaction_id": job['transaction_id'],
            "ticker": ticker,
            "update_field": job['price_point_key'],
            "target_date": date,
            "market_data_price": market_price, 
            "ready_to_update": market_price is not None 
        })

    print("--- 4. Combining and Returning Results ---")
    return jsonify({
        "status": "success",
        "count_jobs_found": len(transactions_for_update),
        "unique_polygon_calls_made": len(jobs_by_date_ticker),
        "transactions_for_update": transactions_for_update
    }), 200

if __name__ == '__main__':
    scheduler = BackgroundScheduler()

    scheduler.add_job(
        func=scan_filings,
        trigger='cron',
        hour=5,
        minute=0,
        timezone='UTC',
        id='daily_filing_scan'
    )

    scheduler.add_job(
        func=check_dates,
        trigger='cron',
        hour=5,
        minute=30,
        timezone='UTC',
        id='daily_observation_check'
    )
    
    scheduler.start()
    print("Scheduler started: Daily filing scan set for 05:00 UTC, and observation date check set for 05:30 UTC.")

    app.run(debug=True, port=5000, use_reloader=False)