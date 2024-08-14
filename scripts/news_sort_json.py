# File: scripts/news_sort_json.py

import json

def sort_json(input_file, output_file):
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    # Sort the keys in the JSON file; the sorting criteria remain unchanged.
    sorted_keys = sorted(data.keys(), key=lambda x: (int(x.split('_')[0]), x.split('_')[1]))
    sorted_data = {key: data[key] for key in sorted_keys}
    
    # Write the sorted data back to a new JSON file.
    with open(output_file, 'w') as f:
        json.dump(sorted_data, f, indent=4)

# Update the paths to reflect the new structure.
input_file = './data/news/merged_news_data.json'
output_file = './data/news/sorted_output.json'

# Execute the sorting function.
sort_json(input_file, output_file)