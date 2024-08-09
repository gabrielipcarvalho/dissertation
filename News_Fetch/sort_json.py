# File: News_Fetch/sort_json.py

import json

def sort_json(input_file, output_file):
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    sorted_keys = sorted(data.keys(), key=lambda x: (int(x.split('_')[0]), x.split('_')[1]))
    sorted_data = {key: data[key] for key in sorted_keys}
    
    with open(output_file, 'w') as f:
        json.dump(sorted_data, f, indent=4)

input_file = './News_Data/merged_news_data.json'
output_file = './News_Data/sorted_output.json'
sort_json(input_file, output_file)