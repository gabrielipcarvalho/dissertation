# File: scripts/stock_organise_series.py

import json

# Constants for the JSON data keys and paths
DATA_TIME_SERIES = "Monthly Time Series"
PATH_SOURCE = "../data/stock/monthly_SPY.json"
PATH_OUTPUT = "../data/stock/reverse_monthly_SPY.json"

# Load the JSON data from a file
with open(PATH_SOURCE, 'r') as file:
    data = json.load(file)

# Extract the time series data
time_series = data[DATA_TIME_SERIES]

# Reverse the order of the time series
reversed_time_series = dict(reversed(list(time_series.items())))

# Add a counter to each date
counter = 1
new_time_series = {}
for date in reversed_time_series:
    new_key = f"{counter}_{date}"
    new_time_series[new_key] = reversed_time_series[date]
    counter += 1

# Update the original data with the new time series
data[DATA_TIME_SERIES] = new_time_series

# Save the updated data back to a file
with open(PATH_OUTPUT, 'w') as file:
    json.dump(data, file, indent=4)

print("The order has been reversed and the counter has been added.")