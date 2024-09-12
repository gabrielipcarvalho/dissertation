import json
import re
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib.pyplot as plt

# File paths
input_file_path = '../../data/logs/eval-organised.logs.json'
output_file_template = '../../data/logs/metric_{metric_type}_{model}.json'

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

# Function to calculate metrics for a given model
def calculate_metrics(predictions, actuals, include_mae_r2=True):
    rmse = np.sqrt(mean_squared_error(actuals, predictions))
    metrics = {"RMSE": rmse}
    
    # Include MAE and R² for monthly and overall metrics
    if include_mae_r2:
        mae = mean_absolute_error(actuals, predictions)
        r2 = r2_score(actuals, predictions) if len(predictions) > 1 else None
        metrics["MAE"] = mae
        if r2 is not None:
            metrics["R²"] = r2
    
    return metrics

# Function to process the data for each model
def evaluate_model(data, model_name):
    daily_metrics = []
    predictions = []
    actuals = []
    monthly_metrics = []
    
    for index, entry in enumerate(data):
        if model_name in entry:
            position = entry["position"]  # Get the position of the current entry
            predicted_direction = entry[model_name]['direction']
            predicted_amount = parse_amount(entry[model_name]['amount'], predicted_direction)
            actual_direction = entry['outcome']['direction']
            actual_amount = parse_amount(entry['outcome']['amount'], actual_direction)
            
            predictions.append(predicted_amount)
            actuals.append(actual_amount)
            
            # For daily metrics, only calculate RMSE and include position
            daily_metric = calculate_metrics([predicted_amount], [actual_amount], include_mae_r2=False)
            daily_metric["position"] = position
            daily_metrics.append(daily_metric)

            # Every 30 positions, calculate monthly metrics (including MAE and R²)
            if (index + 1) % 30 == 0:
                month_metric = calculate_metrics(predictions[-30:], actuals[-30:], include_mae_r2=True)
                month_metric["start_position"] = data[index - 29]["position"]  # Starting position of the 30-day period
                month_metric["end_position"] = position  # Ending position of the 30-day period
                monthly_metrics.append(month_metric)
    
    # Yield monthly metrics with positions for each 30-position window
    if monthly_metrics:
        yield "monthly", monthly_metrics

    # Calculate overall metrics (including MAE and R²)
    overall_metrics = calculate_metrics(predictions, actuals, include_mae_r2=True)
    overall_metrics["start_position"] = data[0]["position"]  # Overall start position
    overall_metrics["end_position"] = data[-1]["position"]  # Overall end position
    yield "overall", [overall_metrics]

    # Return daily metrics (only RMSE and position)
    yield "daily", daily_metrics

# Function to save metrics to JSON file
def save_metrics_to_json(metrics, model_name, metric_type):
    output_file_path = output_file_template.format(metric_type=metric_type, model=model_name)
    with open(output_file_path, 'w') as output_file:
        json.dump(metrics, output_file, indent=4)
    return output_file_path

# Function to plot metrics over time
def plot_metrics(metrics, metric_type, model_name):
    dates = range(1, len(metrics) + 1)
    rmses = [m['RMSE'] for m in metrics]
    
    plt.figure(figsize=(14, 7))
    
    # Plot only RMSE for daily metrics
    if metric_type == "daily":
        plt.plot(dates, rmses, label='RMSE', marker='x')
    else:
        maes = [m['MAE'] for m in metrics if 'MAE' in m]
        r2s = [m['R²'] for m in metrics if 'R²' in m]
        plt.plot(dates, rmses, label='RMSE', marker='x')
        plt.plot(dates, maes, label='MAE', marker='o')
        if r2s:
            plt.plot(dates[:len(r2s)], r2s, label='R²', marker='s')

    plt.xlabel('Date')
    plt.ylabel('Metrics')
    plt.title(f'{metric_type.capitalize()} Metrics for {model_name}')
    plt.legend()
    plt.grid(True)
    plot_file_path = f'../../data/logs/{metric_type}_metrics_{model_name}.png'
    plt.savefig(plot_file_path)
    plt.close()
    return plot_file_path

# Main function to load data and evaluate all models
def main():
    with open(input_file_path, 'r') as file:
        data = json.load(file)
    
    models = ['gptb', 'gptc', 'gptd']
    for model in models:
        model_results = {}
        # Here, metric_type and metrics are unpacked correctly
        for metric_type, metrics in evaluate_model(data, model):
            model_results[metric_type] = metrics
            save_metrics_to_json(metrics, model, metric_type)
            
            # Call plot_metrics with metrics (correctly unpacked)
            plot_metrics(metrics, metric_type, model)  # <- Important: metrics is correctly passed now
    
    return model_results

# Run the main function
if __name__ == "__main__":
    results = main()
