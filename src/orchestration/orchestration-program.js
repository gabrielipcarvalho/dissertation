// src/orchestration/orchestration-program.js

const fs = require("fs");
const path = require("path");
const openai = require("openai"); // Assuming OpenAI SDK is set up

// Import necessary libraries and adaptors
const {
	gpta, // GPTA function
} = require("../adaptors/gpta-adaptor");
const {
	gptb, // GPTB function
} = require("../adaptors/gptb-adaptor");
const {
	gptc, // GPTC function
} = require("../adaptors/gptc-adaptor");
const {
	gptd, // GPTD function
} = require("../adaptors/gptd-adaptor");

const { main: evalGptb } = require("../eval_adaptors/eval-gptb");
const { main: evalGpta } = require("../eval_adaptors/eval-gpta");
const { main: evalGptc } = require("../eval_adaptors/eval-gptc");
const { main: evalGptd } = require("../eval_adaptors/eval-gptd");

// Import fine-tuning and data preparation functions for each model
const prepareGptaData = require("../fine_tuning/gpta_prepare_data");
const fineTuneGpta = require("../fine_tuning/gpta_fine_tune_and_monitor");
const prepareGptbData = require("../fine_tuning/gptb_prepare_data");
const fineTuneGptb = require("../fine_tuning/gptb_fine_tune_and_monitor");
const prepareGptcData = require("../fine_tuning/gptc_prepare_data");
const fineTuneGptc = require("../fine_tuning/gptc_fine_tune_and_monitor");
const prepareGptdData = require("../fine_tuning/gptd_prepare_data");
const fineTuneGptd = require("../fine_tuning/gptd_fine_tune_and_monitor");

require("dotenv").config({ path: "../../config/.env" });

// OpenAI API setup
openai.apiKey = process.env.OPENAI_API_KEY;

// Load the planner file
const plannerData = require(path.resolve(
	__dirname,
	"../../data/planner/planner.json"
));

// Helper function to rename files after fine-tuning
const renameLogsForBatch = (batchNumber) => {
	const logFiles = [
		{
			oldPath: "../../data/logs/eval-gpta.logs.json",
			newPath: `../../data/logs/${batchNumber}-eval-gpta.logs.json`,
		},
		{
			oldPath: "../../data/logs/eval-gptb.logs.json",
			newPath: `../../data/logs/${batchNumber}-eval-gptb.logs.json`,
		},
		{
			oldPath: "../../data/logs/eval-gptc.logs.json",
			newPath: `../../data/logs/${batchNumber}-eval-gptc.logs.json`,
		},
		{
			oldPath: "../../data/logs/eval-gptd.logs.json",
			newPath: `../../data/logs/${batchNumber}-eval-gptd.logs.json`,
		},
		{
			oldPath: "../../data/logs/gpta.logs.json",
			newPath: `../../data/logs/${batchNumber}-gpta.logs.json`,
		},
		{
			oldPath: "../../data/logs/gptb.logs.json",
			newPath: `../../data/logs/${batchNumber}-gptb.logs.json`,
		},
		{
			oldPath: "../../data/logs/gptc.logs.json",
			newPath: `../../data/logs/${batchNumber}-gptc.logs.json`,
		},
		{
			oldPath: "../../data/logs/gptd.logs.json",
			newPath: `../../data/logs/${batchNumber}-gptd.logs.json`,
		},
		{
			oldPath: "../../data/fine_tuning_data/gpta_fine_tuning_data.jsonl",
			newPath: `../../data/fine_tuning_data/${batchNumber}-gpta_fine_tuning_data.jsonl`,
		},
		{
			oldPath: "../../data/fine_tuning_data/gptb_fine_tuning_data.jsonl",
			newPath: `../../data/fine_tuning_data/${batchNumber}-gptb_fine_tuning_data.jsonl`,
		},
		{
			oldPath: "../../data/fine_tuning_data/gptc_fine_tuning_data.jsonl",
			newPath: `../../data/fine_tuning_data/${batchNumber}-gptc_fine_tuning_data.jsonl`,
		},
		{
			oldPath: "../../data/fine_tuning_data/gptd_fine_tuning_data.jsonl",
			newPath: `../../data/fine_tuning_data/${batchNumber}-gptd_fine_tuning_data.jsonl`,
		},
	];

	logFiles.forEach((file) => {
		if (fs.existsSync(path.resolve(__dirname, file.oldPath))) {
			fs.renameSync(
				path.resolve(__dirname, file.oldPath),
				path.resolve(__dirname, file.newPath)
			);
			console.log(`Renamed ${file.oldPath} to ${file.newPath}`);
		}
	});
};

// Function to ensure log files exist before proceeding
const checkLogFileExists = (logFilePath) => {
	return new Promise((resolve, reject) => {
		const maxRetries = 5; // Max retries before throwing an error
		let attempts = 0;
		const checkInterval = setInterval(() => {
			if (fs.existsSync(logFilePath)) {
				clearInterval(checkInterval);
				resolve();
			} else {
				attempts++;
				if (attempts >= maxRetries) {
					clearInterval(checkInterval);
					reject(
						new Error(
							`Log file ${logFilePath} not found after ${maxRetries} attempts`
						)
					);
				}
			}
		}, 2000); // Check every 2 seconds
	});
};

// Function to trigger fine-tuning for GPTA, GPTB, GPTC, GPTD
const fineTuneModels = async (fineTunedModels) => {
	console.log("Starting fine-tuning for GPTA, GPTB, GPTC, GPTD...");

	// Prepare data and fine-tune GPTA
	await prepareGptaData(fineTunedModels.gptaModel);
	const gptaFineTunedModelName = await fineTuneGpta(
		fineTunedModels.gptaModel
	); // Updated to get the model's name
	console.log(`GPTA fine-tuned model name: ${gptaFineTunedModelName}`);
	// Update GPTA model with the new fine-tuned model name
	fineTunedModels.gptaModel = gptaFineTunedModelName;
	console.log(
		`GPTA fine-tuned model updated to: ${fineTunedModels.gptaModel}`
	);

	// Prepare data and fine-tune GPTB
	await prepareGptbData(fineTunedModels.gptbModel);
	const gptbFineTunedModelName = await fineTuneGptb(
		fineTunedModels.gptbModel
	); // Updated to get the model's name
	console.log(`GPTB fine-tuned model name: ${gptbFineTunedModelName}`);
	// Update GPTB model with the new fine-tuned model name
	fineTunedModels.gptbModel = gptbFineTunedModelName;
	console.log(
		`GPTB fine-tuned model updated to: ${fineTunedModels.gptbModel}`
	);

	// Prepare data and fine-tune GPTC
	await prepareGptcData(fineTunedModels.gptcModel);
	const gptcFineTunedModelName = await fineTuneGptc(
		fineTunedModels.gptcModel
	); // Updated to get the model's name
	console.log(`GPTC fine-tuned model name: ${gptcFineTunedModelName}`);
	// Update GPTC model with the new fine-tuned model name
	fineTunedModels.gptcModel = gptcFineTunedModelName;
	console.log(
		`GPTC fine-tuned model updated to: ${fineTunedModels.gptcModel}`
	);

	// Prepare data and fine-tune GPTD
	await prepareGptdData(fineTunedModels.gptdModel);
	const gptdFineTunedModelName = await fineTuneGptd(
		fineTunedModels.gptdModel
	); // Updated to get the model's name
	console.log(`GPTD fine-tuned model name: ${gptdFineTunedModelName}`);

	// Update GPTD model with the new fine-tuned model name
	fineTunedModels.gptdModel = gptdFineTunedModelName;
	console.log(
		`GPTD fine-tuned model updated to: ${fineTunedModels.gptdModel}`
	);

	console.log("Fine-tuning for all models completed.");
};

// Orchestration function to coordinate adaptors and fine-tuning
const orchestrateAdaptors = async () => {
	try {
		let batchNumber = 1;
		let fineTunedModels = {
			gptaModel: "ft:gpt-4o-mini-2024-07-18:personal::A61aSDs3",
			gptbModel: "ft:gpt-4o-mini-2024-07-18:personal::A61oMQw6",
			gptcModel: "ft:gpt-4o-mini-2024-07-18:personal::A624njG0",
			gptdModel: "ft:gpt-4o-mini-2024-07-18:personal::A62ErC61",
		};

		// Iterate over each entry in the planner except the last one
		for (let i = 0; i < plannerData.length - 1; i++) {
			const { position, daily } = plannerData[i];

			// === Step 1: Run Adaptor Functions in Specific Order ===
			console.log(`Processing GPTA for position ${position}`);
			await gpta(position, fineTunedModels.gptaModel);

			console.log(`Processing GPTB for position ${position}`);
			await gptb(position, fineTunedModels.gptbModel);

			console.log(`Processing GPTC for position ${position}`);
			await gptc(position, fineTunedModels.gptcModel);

			console.log(`Processing GPTD for position ${position}`);
			await gptd(position, fineTunedModels.gptdModel);

			// === Step 2: Run Evaluation Functions in Specific Order ===
			console.log(`Evaluating GPTB results for position ${position}`);
			await evalGptb(position, fineTunedModels.gptbModel);

			console.log(`Evaluating GPTA results for position ${position}`);
			await evalGpta(position, fineTunedModels.gptaModel);

			console.log(`Evaluating GPTC results for position ${position}`);
			await evalGptc(position, fineTunedModels.gptcModel);

			console.log(`Evaluating GPTD results for position ${position}`);
			await evalGptd(position, fineTunedModels.gptdModel);

			// // === Step 3: Fine-Tune After Each Batch ===
			// // Fine-tuning is triggered after every 10 positions
			// if (position % 30 === 0) {
			// 	console.log(
			// 		`Fine-tuning after processing position ${position}`
			// 	);
			// 	await fineTuneModels(fineTunedModels);

			// 	// Rename logs after fine-tuning
			// 	renameLogsForBatch(batchNumber);
			// 	batchNumber++;
			// }
		}
	} catch (error) {
		console.error("Error during orchestration:", error);
	}
};

// Execute the orchestration for all planner entries
(async () => {
	await orchestrateAdaptors();
})();

module.exports = { orchestrateAdaptors };
