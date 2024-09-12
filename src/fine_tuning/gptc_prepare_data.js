// src/fine_tuning/gptc_prepare_data.js

const fs = require("fs");
const path = require("path");

// Function to prepare fine-tuning data for GPTC using the correct model
module.exports = function prepareDataForGPTC(model) {
	// Paths to logs
	const gptcLogsPath = path.join(__dirname, "../../data/logs/gptc.logs.json");
	const evalLogsPath = path.join(
		__dirname,
		"../../data/logs/eval-gptc.logs.json"
	);
	const outputPath = path.join(
		__dirname,
		"../../data/fine_tuning_data/gptc_fine_tuning_data.jsonl"
	);

	// Load existing logs
	const gptcLogs = JSON.parse(fs.readFileSync(gptcLogsPath, "utf8"));
	const evalLogs = JSON.parse(fs.readFileSync(evalLogsPath, "utf8"));

	// Prepare fine-tuning data
	const fineTuningData = [];

	// Iterate over logs and prepare fine-tuning dataset
	gptcLogs.forEach((gptcEntry, index) => {
		const evalEntry = evalLogs[index];
		const conversation = {
			messages: [
				{
					role: "system",
					content:
						"You are a financial assistant who predicts stock movements based on historical data.",
				},
				{
					role: "user",
					content: `Here is the stock data for ${gptcEntry["current day"]}: ${gptcEntry.data.prediction}`,
				},
				{
					role: "assistant",
					content: `Evaluation: ${evalEntry.data["predict-evaluation"]}`,
				},
			],
		};
		fineTuningData.push(conversation);
	});

	// Save the fine-tuning data in a JSONL format
	fs.writeFileSync(
		outputPath,
		fineTuningData.map((entry) => JSON.stringify(entry)).join("\n")
	);

	console.log(`Fine-tuning data for ${model} saved to ${outputPath}`);
};
