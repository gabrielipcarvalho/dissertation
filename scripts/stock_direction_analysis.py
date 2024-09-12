import json
import os

# Path to the JSON file
json_file_path = '../data/stock/reverse_daily_SPY.json'

# Load the JSON data
with open(json_file_path, 'r') as file:
    data = json.load(file)

# Iterate over each entry in the "Time Series (Daily)" section
for date_key, values in data["Time Series (Daily)"].items():
    # Calculate the rise or fall
    open_price = float(values["1. open"])
    close_price = float(values["4. close"])
    
    if close_price > open_price:
        direction = "rise"
    else:
        direction = "fall"
    
    # Calculate the percentage change
    amount = ((close_price - open_price) / open_price) * 100
    amount = round(amount, 2)  # Round to two decimal places

    # If it's a fall, make the amount negative
    if direction == "fall":
        amount = -abs(amount)

    # Add the calculated values to the current entry
    values["6. direction"] = direction
    values["7. amount"] = f"{amount}%"

# Save the modified JSON back to the file
with open(json_file_path, 'w') as file:
    json.dump(data, file, indent=4)

print(f"Script executed successfully, and the JSON file '{json_file_path}' has been updated.")
