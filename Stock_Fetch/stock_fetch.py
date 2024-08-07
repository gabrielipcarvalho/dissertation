# File: stock_fetch.py

import requests
import json
import os
from datetime import datetime, timedelta

# Replace with your Alpha Vantage API key
API_KEY = ''
BASE_URL = ''

# Function to fetch data from Alpha Vantage API
def fetch_data(function, symbol='SPY', outputsize='compact', interval=None):
    params = {
        'function': function,
        'symbol': symbol,
        'apikey': API_KEY,
        'outputsize': outputsize
    }
    if interval:
        params['interval'] = interval

    response = requests.get(BASE_URL, params=params)
    data = response.json()
    
    if "Error Message" in data:
        raise ValueError(f"Error fetching data: {data['Error Message']}")
    if "Note" in data:
        raise ValueError(f"Note from API: {data['Note']}")
    if "Information" in data:
        raise ValueError(f"Information from API: {data['Information']}")
    return data

# Function to filter data by date range
def filter_data_by_date(data, start_date, end_date, key):
    if key not in data:
        raise ValueError(f"Key '{key}' not found in data")
    
    filtered_data = {key: {}}
    start_date = datetime.strptime(start_date, '%Y-%m-%d')
    end_date = datetime.strptime(end_date, '%Y-%m-%d')

    for date_str, values in data[key].items():
        date = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S' if ' ' in date_str else '%Y-%m-%d')
        if start_date <= date < end_date:  # Changed <= to < for end_date consistency
            filtered_data[key][date_str] = values
    
    return filtered_data

# Function to save data to a JSON file
def save_data(data, filename):
    os.makedirs('stock_data', exist_ok=True)
    filepath = os.path.join('stock_data', filename)
    with open(filepath, 'w') as file:
        json.dump(data, file, indent=4)
    print(f"Data saved to {filepath}")

# Fetch and save daily data
def fetch_and_save_daily(symbol='SPY', start_date='2023-01-01', end_date='2024-03-11'):
    data = fetch_data('TIME_SERIES_DAILY', symbol, outputsize='full')
    print(f"Fetched daily data: {list(data.keys())}")  # Debug statement
    filtered_data = filter_data_by_date(data, start_date, end_date, 'Time Series (Daily)')
    print(f"Filtered data for range {start_date} to {end_date}: {json.dumps(filtered_data, indent=4)[:500]}")  # Debug statement
    save_data(filtered_data, f'daily_{symbol}.json')

# Fetch and save weekly data
def fetch_and_save_weekly(symbol='SPY', start_date='2023-01-02', end_date='2024-07-14'):
    data = fetch_data('TIME_SERIES_WEEKLY', symbol, outputsize='full')
    print(f"Fetched weekly data: {list(data.keys())}")  # Debug statement
    filtered_data = filter_data_by_date(data, start_date, end_date, 'Weekly Time Series')
    save_data(filtered_data, f'weekly_{symbol}.json')

# Fetch and save monthly data
def fetch_and_save_monthly(symbol='SPY', start_date='2023-01-02', end_date='2024-07-14'):
    data = fetch_data('TIME_SERIES_MONTHLY', symbol, outputsize='full')
    print(f"Fetched monthly data: {list(data.keys())}")  # Debug statement
    filtered_data = filter_data_by_date(data, start_date, end_date, 'Monthly Time Series')
    save_data(filtered_data, f'monthly_{symbol}.json')

if __name__ == '__main__':
    symbol = 'SPY'  # S&P 500 ETF as a proxy
    start_date = '2023-01-02'
    end_date = '2024-07-14'
    try:
        fetch_and_save_daily(symbol, start_date, end_date)
        fetch_and_save_weekly(symbol, start_date, end_date)
        fetch_and_save_monthly(symbol, start_date, end_date)
        print("Data fetching completed successfully.")
    except ValueError as e:
        print(e)
    except Exception as e:
        print(f"An error occurred: {e}")