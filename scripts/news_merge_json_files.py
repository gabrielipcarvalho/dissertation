# File: scripts/news_merge_json_files.py

import os
import json

# Define the directory containing the JSON files
directory = './data/news'

# Initialize an empty dictionary to hold the merged data
merged_data = {}

# Loop over all files in the directory
for filename in os.listdir(directory):
    if filename.endswith('.json'):
        # Construct the full file path
        filepath = os.path.join(directory, filename)
        
        # Read the content of the JSON file
        with open(filepath, 'r', encoding='utf-8') as file:
            data = json.load(file)
        
        # Use the filename (without the extension) as the key in the merged dictionary
        key = os.path.splitext(filename)[0]
        merged_data[key] = data

# Define the output file path
output_file = os.path.join(directory, 'merged_news_data.json')

# Write the merged data to a new JSON file
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(merged_data, outfile, ensure_ascii=False, indent=4)

print(f"Merged data has been written to {output_file}")