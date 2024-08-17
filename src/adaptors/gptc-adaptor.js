// File: src/adaptors/gptc-adaptor.js

const { OpenAI } = require("openai");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config({
	path: path.resolve(__dirname, "../../config/.env"),
});

// Configuration using GPTC's specific API key from the .env file
const openai = new OpenAI({
	apiKey: process.env.GPTC_API_KEY,
});

// Function to read and parse stock price data from JSON file
const readStockPriceData = async (day) => {
	const filePath = path.resolve(__dirname, "../../data/stock/daily_SPY.json");
	try {
		const stockData = JSON.parse(await fs.readFile(filePath, "utf8"));
		const dailyData = stockData["Time Series (Daily)"][day];
		if (!dailyData) {
			throw new Error(`Stock price data for ${day} not found`);
		}
		return dailyData;
	} catch (error) {
		console.error(
			`Error reading stock price data from file: ${filePath}`,
			error
		);
		throw error;
	}
};

// Function to analyze stock prices using GPT model and generate a prediction
const analyzeStockPricesWithGPT = async (stockPrices, currentDay) => {
	const prompt = `Analyze the following stock price data for trends and patterns, and make a concrete prediction for the next trading day. Clearly state whether stock prices are expected to rise or fall, and specify the expected percentage change or price range. Your prediction must be quantitative and actionable, enabling validation against actual market outcomes and also enabling fine-tuning. Consider historical trends, market behavior, and any notable anomalies in the data.

Prediction:
- Direction: Raise or Fall?
- Amount: Specify the expected percentage change (e.g., 5%, 1%, 0.5%)
- Confidence: Express the confidence level of this prediction as a percentage (0-100%).

Reasoning: Provide a concise explanation for the prediction, including relevant factors such as market trends, sentiment shifts, historical data, and any anomalies observed.

The stock price data to analyze is: ${JSON.stringify(stockPrices)}`;

	try {
		const completion = await openai.chat.completions.create({
			model: "gpt-3.5-turbo",
			messages: [
				{
					role: "system",
					content:
						"You are a financial analyst. Your task is to analyze the provided stock price data and make a concrete prediction about future stock price movements. Your prediction must be clear, quantitative, actionable, and include a confidence level.",
				},
				{ role: "user", content: prompt },
			],
		});

		if (
			!completion ||
			!completion.choices ||
			completion.choices.length === 0
		) {
			console.error(
				"Invalid response from the API or missing data:",
				completion
			);
			throw new Error("Invalid response structure from API.");
		}

		const insights = completion.choices[0].message.content.trim();
		return insights;
	} catch (error) {
		console.error(
			"Error during GPT model analysis of stock prices:",
			error
		);
		throw error;
	}
};

// Function to log the GPTC results to a JSON file
const logGptcResults = async (position, day, prediction) => {
	console.log(
		`Logging GPTC prediction results for position ${position}, day ${day}...`
	);
	const logFilePath = path.resolve(
		__dirname,
		"../../data/logs/gptc.logs.json"
	);

	// Read existing log data
	let logData = [];
	try {
		const logFileContents = await fs.readFile(logFilePath, "utf8");
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

	// Append the new log entry
	logData.push({
		position: position,
		"current day": day,
		data: {
			prediction,
		},
	});

	// Write the updated log data back to the file
	await fs.writeFile(logFilePath, JSON.stringify(logData, null, 2), {
		encoding: "utf8",
	});
	console.log(
		`Prediction results logged successfully for position ${position}, day ${day}.`
	);
};

// Main GPTC function
const gptc = async (position) => {
	try {
		console.log(`Starting GPTC processing for position ${position}...`);

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

		const day = entry.daily;
		const stockPrices = await readStockPriceData(day);
		const prediction = await analyzeStockPricesWithGPT(stockPrices, day);

		await logGptcResults(position, day, prediction);

		console.log(`GPTC processing completed for position ${position}.`);
	} catch (error) {
		console.error(`Error in GPTC for position ${position}:`, error);
		throw error;
	}
};

module.exports = {
	gptc,
};
