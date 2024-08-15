# File: scripts/news_sort_json.py

import json
import re

def verify_keys(input_file):
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    # Define a regular expression pattern for the expected key format.
    pattern = re.compile(r'^\d+_\d{4}_\d{2}_\d{2}$')
    
    invalid_keys = []
    
    # Loop over the keys to identify invalid ones and print their context.
    for key in data.keys():
        if not pattern.match(key):
            print(f"Invalid key found: '{key}'")
            invalid_keys.append(key)
            # Print the context of the invalid key
            print(f"Context for invalid key '{key}': {json.dumps(data[key], indent=4)}")
    
    return invalid_keys

def sort_json(input_file, output_file):
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    # Remove keys that do not match the expected format before sorting.
    invalid_keys = verify_keys(input_file)
    for key in invalid_keys:
        data.pop(key, None)
    
    # Sort the remaining keys in the JSON file based on the numeric part and the date.
    sorted_keys = sorted(data.keys(), key=lambda x: (int(x.split('_')[0]), x.split('_')[1]))
    sorted_data = {key: data[key] for key in sorted_keys}
    
    with open(output_file, 'w') as f:
        json.dump(sorted_data, f, indent=4)

# Paths to input and output files.
input_file = '../data/news/merged_news_data.json'
output_file = '../data/news/sorted_output.json'

# Verify keys before sorting.
verify_keys(input_file)

# Execute the sorting function.
sort_json(input_file, output_file)