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
			oldPath: "../../data/fine_tuning_data/eval-gpta.logs.json",
			newPath: `../../data/fine_tuning_data/${batchNumber}-eval-gpta.logs.json`,
		},
		{
			oldPath: "../../data/fine_tuning_data/eval-gptb.logs.json",
			newPath: `../../data/fine_tuning_data/${batchNumber}-eval-gptb.logs.json`,
		},
		{
			oldPath: "../../data/fine_tuning_data/eval-gptc.logs.json",
			newPath: `../../data/fine_tuning_data/${batchNumber}-eval-gptc.logs.json`,
		},
		{
			oldPath: "../../data/fine_tuning_data/eval-gptd.logs.json",
			newPath: `../../data/fine_tuning_data/${batchNumber}-eval-gptd.logs.json`,
		},
		{
			oldPath: "../../data/fine_tuning_data/gpta.logs.json",
			newPath: `../../data/fine_tuning_data/${batchNumber}-gpta.logs.json`,
		},
		{
			oldPath: "../../data/fine_tuning_data/gptb.logs.json",
			newPath: `../../data/fine_tuning_data/${batchNumber}-gptb.logs.json`,
		},
		{
			oldPath: "../../data/fine_tuning_data/gptc.logs.json",
			newPath: `../../data/fine_tuning_data/${batchNumber}-gptc.logs.json`,
		},
		{
			oldPath: "../../data/fine_tuning_data/gptd.logs.json",
			newPath: `../../data/fine_tuning_data/${batchNumber}-gptd.logs.json`,
		},
		{
			oldPath: "../../data/fine_tuning_data/gpta_fine_tuning_data.jsonl",
			newPath: `../../data/fine_tuning_data/${batchNumber}-gpta_fine_tuning_data.jsonl`,
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

// Import fine-tuning and data preparation functions for each model
const prepareGptaData = require("../fine_tuning/gpta_prepare_data");
const fineTuneGpta = require("../fine_tuning/gpta_fine_tune_and_monitor");

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

// Helper function to wait for the fine-tuned model to become available
const waitForModelAvailability = async (fineTunedModel) => {
	const retryDelay = 60000; // 1 minute between retries

	while (true) {
		// Retry indefinitely until the model is available
		try {
			// Try to retrieve the fine-tuned model details
			const response = await openai.models.retrieve(fineTunedModel);
			if (response && response.id === fineTunedModel) {
				console.log(`Model ${fineTunedModel} is now available.`);
				return response;
			}
		} catch (error) {
			if (error.response && error.response.status === 500) {
				// Handle 500 Internal Server Error
				console.error(`Error 500: ${error.message}. Retrying...`);
			} else {
				// Log other types of errors
				console.error(`Error retrieving model: ${error.message}`);
			}
		}

		// Wait for 1 minute before checking again
		await new Promise((resolve) => setTimeout(resolve, retryDelay));
	}
};

// Function to trigger fine-tuning for GPTA, GPTB, GPTC, GPTD
const fineTuneModels = async (fineTunedModels) => {
	console.log("Starting fine-tuning for GPTA, GPTB, GPTC, GPTD...");

	// Prepare data and fine-tune GPTA
	await prepareGptaData(fineTunedModels.gptaModel);
	const gptaFineTuneJobId = await fineTuneGpta(fineTunedModels.gptaModel);

	let gptaFineTuneJob;
	while (true) {
		try {
			// Fetch the new model name after fine-tuning completes
			gptaFineTuneJob = await openai.fineTuning.jobs.retrieve(
				gptaFineTuneJobId
			);
			if (gptaFineTuneJob && gptaFineTuneJob.status === "succeeded") {
				fineTunedModels.gptaModel = gptaFineTuneJob.fine_tuned_model;
				console.log(
					`GPTA fine-tuned model updated to: ${fineTunedModels.gptaModel}`
				);

				// Wait until the fine-tuned model is available for use
				await waitForModelAvailability(fineTunedModels.gptaModel);
				break; // Exit the loop once successful
			} else {
				console.log(
					`GPTA fine-tuning job status: ${
						gptaFineTuneJob?.status || "Unknown"
					}. Retrying...`
				);
			}
		} catch (error) {
			console.error(
				`Error retrieving fine-tuning job status for GPTA: ${error.message}. Retrying in 1 minute...`
			);
		}

		// Wait for 1 minute before retrying to retrieve the job status
		await new Promise((resolve) => setTimeout(resolve, 60000));
	}

	// Repeat for other models (GPTB, GPTC, GPTD) if needed...
	// Uncomment the following for GPTB, GPTC, and GPTD fine-tuning:
	/*
    await prepareGptbData(fineTunedModels.gptbModel);
    const gptbFineTuneJobId = await fineTuneGptb(fineTunedModels.gptbModel);
    let gptbFineTuneJob;
    try {
        gptbFineTuneJob = await openai.fineTuning.jobs.retrieve(gptbFineTuneJobId);
    } catch (error) {
        console.error(`Error retrieving fine-tuning job status for GPTB: ${error.message}`);
        return;
    }
    if (gptbFineTuneJob && gptbFineTuneJob.status === "succeeded") {
        fineTunedModels.gptbModel = gptbFineTuneJob.fine_tuned_model;
        await waitForModelAvailability(fineTunedModels.gptbModel);
    }
    */

	console.log("Fine-tuning for all models completed.");
};

// Orchestration function to coordinate adaptors and fine-tuning
const orchestrateAdaptors = async () => {
	try {
		let position = 10;
		let batchNumber = 1;
		let fineTunedModels = {
			gptaModel: "gpt-4o-mini-2024-07-18",
			gptbModel: "gpt-4o-mini-2024-07-18",
			gptcModel: "gpt-4o-mini-2024-07-18",
			gptdModel: "gpt-4o-mini-2024-07-18",
		};
		console.log(`Fine-tuning after processing position ${position}`);
		await fineTuneModels(fineTunedModels);

		// Rename logs after fine-tuning
		renameLogsForBatch(batchNumber);
		batchNumber++;
	} catch (error) {
		console.error("Error during orchestration:", error);
	}
};

// try {
// 	let batchNumber = 1;
// 	let fineTunedModels = {
// 		gptaModel: "gpt-4o-mini-2024-07-18",
// 		gptbModel: "gpt-4o-mini-2024-07-18",
// 		gptcModel: "gpt-4o-mini-2024-07-18",
// 		gptdModel: "gpt-4o-mini-2024-07-18",
// 	};

// 	// Iterate over each entry in the planner except the last one
// 	for (let i = 0; i < plannerData.length - 1; i++) {
// 		const { position, daily } = plannerData[i];

// 		// === Step 1: Run Adaptor Functions in Specific Order ===
// 		console.log(`Processing GPTA for position ${position}`);
// 		await gpta(position, fineTunedModels.gptaModel);

// 		console.log(`Processing GPTB for position ${position}`);
// 		await gptb(position, fineTunedModels.gptbModel);

// 		console.log(`Processing GPTC for position ${position}`);
// 		await gptc(position, fineTunedModels.gptcModel);

// 		console.log(`Processing GPTD for position ${position}`);
// 		await gptd(position, fineTunedModels.gptdModel);

// 		// === Step 2: Run Evaluation Functions in Specific Order ===
// 		console.log(`Evaluating GPTB results for position ${position}`);
// 		await evalGptb(position, fineTunedModels.gptbModel);

// 		console.log(`Evaluating GPTA results for position ${position}`);
// 		await evalGpta(position, fineTunedModels.gptaModel);

// 		console.log(`Evaluating GPTC results for position ${position}`);
// 		await evalGptc(position, fineTunedModels.gptcModel);

// 		console.log(`Evaluating GPTD results for position ${position}`);
// 		await evalGptd(position, fineTunedModels.gptdModel);

// 		// === Step 3: Fine-Tune After Each Batch ===
// 		// Fine-tuning is triggered after every 10 positions
// 		if (position % 10 === 0) {
// 			console.log(
// 				`Fine-tuning after processing position ${position}`
// 			);
// 			await fineTuneModels(fineTunedModels);

// 			// Rename logs after fine-tuning
// 			renameLogsForBatch(batchNumber);
// 			batchNumber++;
// 		}
// 	}
// } catch (error) {
// 	console.error("Error during orchestration:", error);
// }

// Execute the orchestration for all planner entries
(async () => {
	await orchestrateAdaptors();
})();

module.exports = { orchestrateAdaptors };
