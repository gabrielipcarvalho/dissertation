// File: src/adaptors/gptd-adaptor.js

const { OpenAI } = require("openai");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config({
	path: path.resolve(__dirname, "../../config/.env"),
});

// Configuration using GPTD's specific API key from the .env file
const openai = new OpenAI({
	apiKey: process.env.GPTD_API_KEY,
});

// Function to read JSON data from a file
const readJSONData = async (filePath) => {
	try {
		const dataJson = await fs.readFile(filePath, { encoding: "utf8" });
		return JSON.parse(dataJson);
	} catch (error) {
		console.error(`Error reading JSON file: ${filePath}`, error);
		throw error;
	}
};

// Function to log or update data in a JSON file
const logDataToFile = async (filePath, position, currentDay, newData) => {
	let logData = [];
	try {
		const logFileContents = await fs.readFile(filePath, "utf8");
		if (logFileContents.trim()) {
			logData = JSON.parse(logFileContents);
		} else {
			console.log("Log file is empty, starting with a new log file.");
		}
	} catch (error) {
		if (error.code === "ENOENT") {
			console.log("Log file not found, creating a new one.");
		} else if (error instanceof SyntaxError) {
			console.error(
				"Log file is malformed, starting with a new log file."
			);
		} else {
			throw error;
		}
	}

	// Find the existing log entry
	let logEntry = logData.find(
		(item) =>
			item.position === position && item["current day"] === currentDay
	);

	if (logEntry) {
		// Merge new data with the existing data
		logEntry.data = { ...logEntry.data, ...newData };
	} else {
		// If no entry exists, create a new one
		logEntry = {
			position: position,
			"current day": currentDay,
			data: newData,
		};
		logData.push(logEntry);
	}

	// Write the updated log data back to the file
	await fs.writeFile(filePath, JSON.stringify(logData, null, 2), {
		encoding: "utf8",
	});

	// Convert the absolute path to a relative path for logging
	const relativePath = path.relative(process.cwd(), filePath);
	console.log(`Data logged successfully to ${relativePath}.`);
};

// Function to fetch prediction data from logs
const fetchPredictionData = async (position, filePath) => {
	const logData = await readJSONData(filePath);
	const entry = logData.find((item) => item.position === position);
	if (!entry) {
		throw new Error(
			`No entry found for position ${position} in ${filePath}`
		);
	}
	return entry.data.prediction;
};

// Function to integrate and analyze predictions from GPTB and GPTC
const integrateAndAnalyzePredictions = async (
	position,
	currentDay,
	modelName
) => {
	// Added modelName parameter
	try {
		const gptbLogsPath = path.resolve(
			__dirname,
			"../../data/logs/gptb.logs.json"
		);
		const gptcLogsPath = path.resolve(
			__dirname,
			"../../data/logs/gptc.logs.json"
		);

		const gptbPrediction = await fetchPredictionData(
			position,
			gptbLogsPath
		);
		const gptcPrediction = await fetchPredictionData(
			position,
			gptcLogsPath
		);

		const prompt = `Integrate and analyze predictions from GPTB and GPTC for Day ${currentDay}, assessing the alignment and discrepancies between the two forecasts. Ensure the analysis highlights key points of agreement and divergence between the models, providing a comprehensive understanding of their predictions. Predictions from GPTB: ${gptbPrediction}, Predictions from GPTC: ${gptcPrediction}.`;

		const completion = await openai.chat.completions.create({
			model: modelName, // Use dynamic model name here
			messages: [
				{
					role: "system",
					content:
						"Synthesize the information from GPTB and GPTC models to provide a cohesive analysis. Your analysis should integrate insights from both models, highlighting areas of agreement and divergence, and explain the implications for stock price movements. Ensure the analysis is detailed and includes quantitative assessments where possible. Make sure your response is within 1500 characters.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
		});

		if (
			!completion ||
			!completion.choices ||
			completion.choices.length === 0
		) {
			throw new Error("Invalid response structure from API.");
		}

		const combinedAnalysis = completion.choices[0].message.content.trim();
		const logData = {
			position: position,
			"current day": currentDay,
			data: {
				analysis: combinedAnalysis,
			},
		};

		const gptdLogsPath = path.resolve(
			__dirname,
			"../../data/logs/gptd.logs.json"
		);
		await logDataToFile(gptdLogsPath, position, currentDay, {
			analysis: combinedAnalysis,
		});

		return combinedAnalysis;
	} catch (error) {
		console.error(
			"Error during integration and analysis of predictions:",
			error
		);
		throw error;
	}
};

// Function to make a final prediction for the next trading day stock prices
const makeFinalPrediction = async (position, currentDay, modelName) => {
	// Added modelName parameter
	try {
		const gptdLogsPath = path.resolve(
			__dirname,
			"../../data/logs/gptd.logs.json"
		);
		const logData = await readJSONData(gptdLogsPath);
		const entry = logData.find(
			(item) =>
				item.position === position && item["current day"] === currentDay
		);

		if (!entry) {
			throw new Error(
				`No analysis data found for position ${position} and day ${currentDay} in GPTD logs.`
			);
		}

		const analysisData = entry.data.analysis;
		const nextDay = `day${parseInt(currentDay.replace("day", "")) + 1}`;

		const prompt = `Based on the integrated analysis from Day ${currentDay}, synthesize insights to make a final, comprehensive prediction for ${nextDay} stock prices. Your prediction should clearly state whether stock prices are expected to rise or fall, by how much, and the reasoning behind your forecast. Ensure the prediction is quantitative, specifying the expected percentage change or price range. Additionally, express the confidence level of this prediction as a percentage (0-100%).

Prediction:
- Direction: Raise or Fall?
- Amount: Specify the expected percentage change (e.g., 5%, 1%, 0.5%)
- Confidence: Express the confidence level of this prediction as a percentage (0-100%).

Reasoning: Provide a concise explanation for the prediction, including relevant factors such as market trends, sentiment shifts, historical data, and any anomalies observed. Make sure your response is within 1500 characters. Analysis data: ${analysisData}.`;

		const completion = await openai.chat.completions.create({
			model: modelName, // Use dynamic model name here
			messages: [
				{
					role: "system",
					content:
						"Provide a detailed forecast using the integrated analysis from GPTB and GPTC. Your forecast should clearly state whether stock prices will rise or fall, by how much, and include the reasoning behind your prediction. Ensure the forecast is actionable and precise, including a confidence level, to enable validation against actual market outcomes. Make sure the response is within 1500 characters.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
		});

		if (
			!completion ||
			!completion.choices ||
			completion.choices.length === 0
		) {
			throw new Error("Invalid response structure from API.");
		}

		const finalPrediction = completion.choices[0].message.content.trim();

		// Update the existing entry with the new prediction
		entry.data.prediction = finalPrediction;

		// Write the updated log data back to the file
		await logDataToFile(gptdLogsPath, position, currentDay, entry.data);

		return finalPrediction;
	} catch (error) {
		console.error("Error making final prediction for stock prices:", error);
		throw error;
	}
};

// Main GPTD function to integrate analysis and make predictions
const gptd = async (position, modelName) => {
	// Accept modelName as parameter
	try {
		console.log(
			`Starting GPTD processing for position ${position} using model ${modelName}...`
		);

		// Load the planner file and get the corresponding daily entry for the position
		const plannerPath = path.resolve(
			__dirname,
			"../../data/planner/planner.json"
		);
		const plannerData = JSON.parse(await fs.readFile(plannerPath, "utf8"));
		const entry = plannerData.find((item) => item.position === position);

		if (!entry || !entry.daily) {
			throw new Error(`No daily entry found for position ${position}`);
		}

		const currentDay = entry.daily;

		// Integrate and analyze predictions from GPTB and GPTC
		await integrateAndAnalyzePredictions(position, currentDay, modelName);

		// Make final prediction for the next trading day stock prices
		await makeFinalPrediction(position, currentDay, modelName);

		console.log(`GPTD processing completed for position ${position}.`);
	} catch (error) {
		console.error(`Error in GPTD for position ${position}:`, error);
		throw error;
	}
};

module.exports = {
	gptd,
};
