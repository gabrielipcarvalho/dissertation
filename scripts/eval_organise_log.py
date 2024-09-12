import json
from collections import OrderedDict

# Define file paths
input_file_path = '../data/logs/eval.logs.json'
output_file_path = '../data/logs/eval-organised.logs.json'

def reorganise_json(file_path, output_path):
    # Load the original JSON file
    with open(file_path, 'r') as file:
        data = json.load(file)
    
    # Reorganise each dictionary in the list
    organised_data = []
    for item in data:
        # Create an ordered dictionary to maintain the desired order
        ordered_item = OrderedDict()
        
        # Add all items except 'outcome'
        for key, value in item.items():
            if key != "outcome":
                ordered_item[key] = value
        
        # Add 'outcome' at the end
        ordered_item["outcome"] = item["outcome"]
        
        # Append the ordered dictionary to the organised data list
        organised_data.append(ordered_item)
    
    # Save the organised data to a new JSON file
    with open(output_path, 'w') as output_file:
        json.dump(organised_data, output_file, indent=4)

# Run the function to reorganise the JSON file
reorganise_json(input_file_path, output_file_path)

print(f"Organised file saved at: {output_file_path}")
