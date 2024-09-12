const fs = require("fs");
const path = require("path");

// Export function to be used in orchestration
module.exports = function prepareDataForFineTuning(modelId) {
	console.log(`Preparing data for GPTB fine-tuning with model: ${modelId}`);

	// Paths to logs
	const gptbLogsPath = path.join(__dirname, "../../data/logs/gptb.logs.json");
	const evalGptbLogsPath = path.join(
		__dirname,
		"../../data/logs/eval-gptb.logs.json"
	);
	const outputPath = path.join(
		__dirname,
		"../../data/fine_tuning_data/gptb_fine_tuning_data.jsonl"
	);

	// Load existing logs when the function is called
	const gptbLogs = JSON.parse(fs.readFileSync(gptbLogsPath, "utf8"));
	const evalGptbLogs = JSON.parse(fs.readFileSync(evalGptbLogsPath, "utf8"));

	// Prepare fine-tuning data
	const fineTuningData = [];

	// Group eval_gptb_logs by position for easy lookup
	const evalGptbLogsByPosition = evalGptbLogs.reduce((acc, evalEntry) => {
		const position = evalEntry.position;
		if (!acc[position]) {
			acc[position] = [];
		}
		acc[position].push(evalEntry);
		return acc;
	}, {});

	// Iterate over gptb logs and match with the corresponding eval-gptb logs (shifted by 1)
	gptbLogs.forEach((gptbEntry) => {
		const position = gptbEntry.position;
		const nextPosition = position + 1; // Match with eval-gptb.logs.json position X+1

		if (evalGptbLogsByPosition[nextPosition]) {
			const evalEntries = evalGptbLogsByPosition[nextPosition];

			// Prepare fine-tuning data for each evaluation entry found
			evalEntries.forEach((evalEntry) => {
				const conversation = {
					messages: [
						{
							role: "system",
							content:
								"You are a financial market prediction model that makes stock price predictions based on sentiment analysis and historical data.",
						},
						{
							role: "user",
							content: `Here is the analysis and prediction for position ${position} (current day: ${gptbEntry["current day"]}):\n${gptbEntry.data.analysis}\nPrediction: ${gptbEntry.data.prediction}`,
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

	return fineTuningData;
};
