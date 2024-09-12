import json
from collections import OrderedDict

# Load the JSON files
with open('../data/stock/_daily_SPY.json', 'r') as daily_file:
    daily_data = json.load(daily_file)

with open('../data/stock/reverse_daily_SPY.json', 'r') as reverse_file:
    reverse_data = json.load(reverse_file)

# Get the time series from both files
daily_time_series = daily_data["Time Series (Daily)"]
reverse_time_series = reverse_data["Time Series (Daily)"]

# Refactor reverse_time_series to have negative index starting at 0_date, -1_date, -2_date, etc.
refactored_reverse_series = {}
for i, (key, value) in enumerate(reverse_time_series.items()):
    # Extract the date part from the original key and create the new key with a negative index
    date = key.split('_')[1]
    new_key = f"{-i}_{date}"  # Example: 0_2022-02-01, -1_2022-02-02
    refactored_reverse_series[new_key] = value

# Merge both time series dictionaries
merged_series = {**refactored_reverse_series, **daily_time_series}

# Sort the merged series by the numeric part of the key (keeping date in mind)
sorted_series = OrderedDict(sorted(merged_series.items(), key=lambda x: int(x[0].split('_')[0])))

# Create a new dictionary to hold the final structure
merged_data = {
    "Time Series (Daily)": sorted_series
}

# Save the merged and sorted data to a new JSON file
with open('../data/stock/merged_daily_SPY.json', 'w') as merged_file:
    json.dump(merged_data, merged_file, indent=4)

print("Merging complete. File saved as 'data/stock/merged_daily_SPY.json'.")
