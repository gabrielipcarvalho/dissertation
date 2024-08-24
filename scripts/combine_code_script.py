# File: scripts/combine_code_script.py

import os

# Define the directories and file extensions to include
directories_to_include = [
    # "../scripts",
    "../src/orchestration",
    "../src/adaptors",
    "../src/eval_adaptors",
    # "../src/news_fetch",
    # "../src/planner",
    # "../src/stock_fetch"
]
extensions_to_include = ['.py', '.js']

# Define the output file path
output_file_path = '../docs/combined_code.txt'

# Start writing to the output file
with open(output_file_path, 'w') as output_file:
    for directory in directories_to_include:
        for root, _, files in os.walk(directory):
            for fil in files:
                if any(fil.endswith(ext) for ext in extensions_to_include):
                    file_path = os.path.join(root, fil)
                    output_file.write(f"\n{'='*40}\n")
                    output_file.write(f"File: {file_path}\n")
                    output_file.write(f"{'='*40}\n\n")
                    with open(file_path, 'r') as f:
                        output_file.write(f.read())
                        output_file.write("\n")

    # Include this script's code at the end of the file
    script_path = './scripts/combine_code_script.py'
    output_file.write(f"\n{'='*40}\n")
    output_file.write(f"File: {script_path}\n")
    output_file.write(f"{'='*40}\n\n")
    with open(__file__, 'r') as f:
        output_file.write(f.read())
        output_file.write("\n")

print(f"All code has been combined into {output_file_path}")