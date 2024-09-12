// src/fine_tuning/gptd_prepare_data.js

const fs = require("fs");
const path = require("path");

// Function to prepare fine-tuning data, now accepting the model as an argument
module.exports = function prepareDataForFineTuning(model) {
	console.log(`Preparing fine-tuning data for model: ${model}`);

	// Paths to logs
	const gptdLogsPath = path.join(__dirname, "../../data/logs/gptd.logs.json");
	const evalGptdLogsPath = path.join(
		__dirname,
		"../../data/logs/eval-gptd.logs.json"
	);
	const outputPath = path.join(
		__dirname,
		"../../data/fine_tuning_data/gptd_fine_tuning_data.jsonl"
	);

	// Load existing logs
	const gptdLogs = JSON.parse(fs.readFileSync(gptdLogsPath, "utf8"));
	const evalGptdLogs = JSON.parse(fs.readFileSync(evalGptdLogsPath, "utf8"));

	// Prepare fine-tuning data
	const fineTuningData = [];

	// Group eval_gptd_logs by position for easy lookup
	const evalGptdLogsByPosition = evalGptdLogs.reduce((acc, evalEntry) => {
		const position = evalEntry.position;
		if (!acc[position]) {
			acc[position] = [];
		}
		acc[position].push(evalEntry);
		return acc;
	}, {});

	// Iterate over gptd logs and match them with eval-gptd logs
	gptdLogs.forEach((gptdEntry) => {
		const position = gptdEntry.position;
		const evalPosition = position + 1; // Match position 1 with position 2 in eval

		if (evalGptdLogsByPosition[evalPosition]) {
			const matchingEvalEntries = evalGptdLogsByPosition[evalPosition];

			// Prepare fine-tuning data for each matching entry
			matchingEvalEntries.forEach((evalEntry) => {
				const conversation = {
					messages: [
						{
							role: "system",
							content:
								"You are an expert financial assistant who predicts stock movements based on model analysis and market data.",
						},
						{
							role: "user",
							content: `Here is the analysis and prediction for position ${gptdEntry.position}: ${gptdEntry.data.analysis} \nPrediction: ${gptdEntry.data.prediction}`,
						},
						{
							role: "assistant",
							content: `Evaluation: ${evalEntry.data["predict-evaluation"]}`,
						},
					],
				};
				fineTuningData.push(conversation);
			});
		}
	});

	// Save the fine-tuning data in a JSONL format
	fs.writeFileSync(
		outputPath,
		fineTuningData.map((entry) => JSON.stringify(entry)).join("\n")
	);

	console.log(`Fine-tuning data saved to ${outputPath}`);
};
