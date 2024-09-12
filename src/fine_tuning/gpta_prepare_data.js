// src/fine_tuning/gpta_prepare_data.js

const fs = require("fs");
const path = require("path");

// Function to prepare fine-tuning data
module.exports = function prepareGptaData(modelId) {
	// Paths to logs
	const gptaLogsPath = path.join(__dirname, "../../data/logs/gpta.logs.json");
	const evalGptaLogsPath = path.join(
		__dirname,
		"../../data/logs/eval-gpta.logs.json"
	);
	const outputPath = path.join(
		__dirname,
		"../../data/fine_tuning_data/gpta_fine_tuning_data.jsonl"
	);

	// Load existing logs
	const gptaLogs = JSON.parse(fs.readFileSync(gptaLogsPath, "utf8"));
	const evalGptaLogs = JSON.parse(fs.readFileSync(evalGptaLogsPath, "utf8"));

	// Prepare fine-tuning data
	const fineTuningData = [];

	// Group eval_gpta_logs by position for easy lookup
	const evalGptaLogsByPosition = evalGptaLogs.reduce((acc, evalEntry) => {
		const position = evalEntry.position;
		if (!acc[position]) {
			acc[position] = [];
		}
		acc[position].push(evalEntry);
		return acc;
	}, {});

	// Iterate over gpta logs and gather all entries for the same position
	const gptaDataByPosition = gptaLogs.reduce((acc, gptaEntry) => {
		const position = gptaEntry.position;

		if (!acc[position]) {
			acc[position] = {
				"key information": "",
				"sentiment analysis": "",
			};
		}

		// Concatenate key information and sentiment analysis for the same position
		acc[position]["key information"] +=
			gptaEntry.data["key information"] + "\n\n";
		acc[position]["sentiment analysis"] +=
			gptaEntry.data["sentiment analysis"] + "\n\n";

		return acc;
	}, {});

	// Now, match the concatenated data with eval-gpta logs by position
	Object.keys(gptaDataByPosition).forEach((position) => {
		if (evalGptaLogsByPosition[position]) {
			const evalEntries = evalGptaLogsByPosition[position];

			// Prepare fine-tuning data for each evaluation entry found
			evalEntries.forEach((evalEntry) => {
				const conversation = {
					messages: [
						{
							role: "system",
							content:
								"You are an expert in stock market sentiment analysis.",
						},
						{
							role: "user",
							content: `Here is the key information and sentiment analysis for position ${position}:\n${gptaDataByPosition[position]["key information"]}\nSentiment: ${gptaDataByPosition[position]["sentiment analysis"]}`,
						},
						{
							role: "assistant",
							content: `Evaluation: ${evalEntry.evaluation}`,
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

	console.log(`Fine-tuning data for model ${modelId} saved to ${outputPath}`);
};
