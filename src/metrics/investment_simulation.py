import json
import re

# File path for the JSON data
input_file_path = '../../data/logs/eval-organised.logs.json'

# Initial investment
initial_investment = 10000.00

# Function to parse and clean the amount
def parse_amount(amount_str, direction):
    # Handle cases like "from 1.0% to 1.5%" or "Approximately 1.5% decline"
    if "from" in amount_str:
        amount_str = re.search(r'\d+(\.\d+)?', amount_str).group(0)  # Take the first number
    elif "Approximately" in amount_str or "decline" in amount_str:
        amount_str = re.search(r'\d+(\.\d+)?', amount_str).group(0)  # Get the numeric part
    
    # Remove any remaining non-numeric characters, %, etc.
    amount_str = re.sub(r'[^\d.-]', '', amount_str)

    # Attempt to convert the cleaned string to a float
    try:
        amount = float(amount_str)
    except ValueError:
        amount = 0.0
    
    # If direction is 'fall' and the amount is positive, invert the value
    if direction.lower() == "fall" and amount > 0:
        amount = -amount

    return amount


# Function to simulate investment strategy
def simulate_investment(data, initial_investment, model_name):
    capital = initial_investment
    holdings = 0.0  # No stock purchased initially

    for entry in data:
        prediction_direction = entry[model_name]['direction']
        prediction_amount = parse_amount(entry[model_name]['amount'], prediction_direction)
        actual_direction = entry['outcome']['direction']
        actual_amount = parse_amount(entry['outcome']['amount'], actual_direction)

        if prediction_direction.lower() == 'rise' and capital > 0:
            # Buy: Invest all available capital
            holdings = capital * (1 + prediction_amount / 100)
            capital = 0.0  # All capital is now in stock

        elif prediction_direction.lower() == 'fall' and holdings > 0:
            # Sell: Convert holdings back to capital based on the actual outcome
            capital = holdings * (1 + actual_amount / 100)
            holdings = 0.0  # Sold all holdings

        # Reinvestment logic: if holdings are 0 and prediction is rise, buy again
        if capital > 0 and holdings == 0 and prediction_direction.lower() == 'rise':
            holdings = capital * (1 + prediction_amount / 100)
            capital = 0.0  # Reinvest cash

    # Final valuation
    final_value = capital + holdings
    return final_value

# Main function to load data and run the simulation for each model
def main():
    # Load the JSON data
    with open(input_file_path, 'r') as file:
        data = json.load(file)
    
    # List of models to evaluate
    models = ['gptb', 'gptc', 'gptd']
    
    # Dictionary to store final values for each model
    final_values = {}
    
    for model in models:
        final_value = simulate_investment(data, initial_investment, model)
        final_values[model] = final_value
        print(f"Final value for {model} after simulation: ${final_value:.2f}")

    return final_values

# Run the main function
if __name__ == "__main__":
    results = main()
