// src/fine_tuning/gpta_fine_tune_and_monitor.js

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { OpenAI } = require("openai"); // Correct import from the latest SDK

// Load environment variables from the .env file
dotenv.config({ path: path.join(__dirname, "../../config/.env") });

// Load the OpenAI API key from the environment variable
const openaiApiKey = process.env.GPTA_API_KEY;

if (!openaiApiKey) {
	throw new Error(
		"API key for OpenAI is missing. Please set it in the GPTA_API_KEY environment variable."
	);
}

// Initialize the OpenAI client directly
const openai = new OpenAI({
	apiKey: openaiApiKey,
});

// Upload the dataset for fine-tuning
const fineTuningFilePath = path.join(
	__dirname,
	"../../data/fine_tuning_data/gpta_fine_tuning_data.jsonl"
);

async function uploadTrainingFile() {
	try {
		const fileStream = fs.createReadStream(fineTuningFilePath);
		const response = await openai.files.create({
			file: fileStream,
			purpose: "fine-tune",
		});
		return response.id; // Return the file ID
	} catch (error) {
		console.error(
			"Error uploading file:",
			error.response ? error.response.data : error.message
		);
		throw error;
	}
}

// Using the new fine-tuning API method
async function createFineTuningJob(trainingFileId, modelId) {
	try {
		const response = await openai.fineTuning.jobs.create({
			training_file: trainingFileId,
			model: modelId, // Use the passed modelId from the orchestration program
			hyperparameters: {
				n_epochs: 4, // Fine-tuning for 4 epochs
			},
		});
		console.log(`Fine-tuning job started with ID: ${response.id}`);
		return response.id; // Return the fine-tuning job ID
	} catch (error) {
		console.error(
			"Error creating fine-tuning job:",
			error.response ? error.response.data : error.message
		);
		throw error;
	}
}

// Function to check the job status with retry on 500 errors
async function checkJobStatus(jobId) {
	try {
		const response = await openai.fineTuning.jobs.retrieve(jobId);
		const status = response.status;
		console.log(`Fine-tuning job status: ${status}`);
		return status;
	} catch (error) {
		// Handle 500 error by retrying
		if (error.response && error.response.status === 500) {
			console.error(
				`Error 500: ${error.message}. Retrying in 1 minute...`
			);
			await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait for 1 minute before retrying
			return checkJobStatus(jobId); // Retry the status check
		} else {
			console.error(
				"Error retrieving job status:",
				error.response ? error.response.data : error.message
			);
			throw error; // If it's not a 500 error, rethrow the error
		}
	}
}

async function getFineTunedModelName(jobId) {
	try {
		// Retrieve the fine-tuning job details to get the trained model name
		const fineTuneJob = await openai.fineTuning.jobs.retrieve(jobId);
		if (
			fineTuneJob.status === "succeeded" &&
			fineTuneJob.fine_tuned_model
		) {
			const fineTunedModelName = fineTuneJob.fine_tuned_model;
			console.log(`Fine-tuned model name: ${fineTunedModelName}`);
			return fineTunedModelName;
		} else {
			console.log(`Fine-tuning job status: ${fineTuneJob.status}.`);
			return null;
		}
	} catch (error) {
		console.error(
			"Error retrieving fine-tuned model name:",
			error.response ? error.response.data : error.message
		);
		throw error;
	}
}

async function monitorJobStatus(jobId) {
	while (true) {
		const status = await checkJobStatus(jobId);
		if (status === "succeeded" || status === "failed") {
			return status; // Return the final job status
		}
		console.log("Waiting for 1 minute before the next check...");
		await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait for 1 minute (60000ms)
	}
}

// Helper function to wait for the fine-tuned model to become available with retry on 500 errors
async function waitForModelAvailability(fineTunedModel) {
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
				console.error(
					`Error 500: ${error.message}. Retrying in 1 minute...`
				);
			} else {
				// Log other types of errors
				console.error(`Error retrieving model: ${error.message}`);
			}
		}

		// Wait for 1 minute before checking again
		await new Promise((resolve) => setTimeout(resolve, retryDelay));
	}
}

async function listRecentFineTuningJobs() {
	try {
		const response = await openai.fineTuning.jobs.list({ limit: 10 });
		console.log("Recent fine-tuning jobs:");
		response.data.forEach((job) => {
			console.log(`Job ID: ${job.id}, Status: ${job.status}`);
		});
	} catch (error) {
		console.error(
			"Error listing recent jobs:",
			error.response ? error.response.data : error.message
		);
		throw error;
	}
}

// Main async function to run the workflow
module.exports = async function fineTuneGptaModel(modelId) {
	try {
		// Step 1: Upload training file
		const trainingFileId = await uploadTrainingFile();
		console.log(`Training file uploaded with ID: ${trainingFileId}`);

		// Step 2: Create the fine-tuning job, return job ID
		async function createFineTuningJobWithRetry(retries = 3) {
			try {
				const fineTuneJobId = await createFineTuningJob(
					trainingFileId,
					modelId
				);
				console.log(
					`Fine-tuning job started with ID: ${fineTuneJobId}`
				);
				return fineTuneJobId; // Return the job ID for further monitoring
			} catch (error) {
				if (retries > 0) {
					console.log(
						`Retrying fine-tuning job creation... (${
							3 - retries + 1
						} of 3 attempts)`
					);
					return await createFineTuningJobWithRetry(retries - 1);
				} else {
					throw new Error(
						"Failed to create fine-tuning job after 3 attempts."
					);
				}
			}
		}

		const fineTuneJobId = await createFineTuningJobWithRetry();
		if (!fineTuneJobId) {
			throw new Error("Failed to retrieve fine-tuning job ID.");
		}

		// Step 3: Monitor job status until it completes (succeeded or failed)
		const finalStatus = await monitorJobStatus(fineTuneJobId);
		if (finalStatus === "succeeded") {
			console.log("Fine-tuning completed successfully!");
		} else if (finalStatus === "failed") {
			console.log(
				"Fine-tuning failed. Please check the logs or contact support."
			);
			return null; // If failed, return null
		}

		// Step 4: Retrieve the fine-tuned model's name
		const fineTunedModelName = await getFineTunedModelName(fineTuneJobId);
		if (!fineTunedModelName) {
			throw new Error(
				"Failed to retrieve the fine-tuned model name after completion."
			);
		}
		console.log(fineTunedModelName);

		// Step 5: Wait for the fine-tuned model to become available
		await waitForModelAvailability(fineTunedModelName);

		// Step 6: List recent fine-tuning jobs for debugging purposes
		await listRecentFineTuningJobs();

		// Return the fine-tuned model name
		return fineTunedModelName;
	} catch (error) {
		console.error(
			"An error occurred during the fine-tuning process:",
			error.message
		);
		throw error;
	}
};
