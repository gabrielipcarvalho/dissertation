const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
require("dotenv").config({
	path: path.resolve(__dirname, "../../config/.env"),
});

// Configuration using GPTB's specific API key from the .env file
const openai = new OpenAI({
	apiKey: process.env.GPTB_API_KEY,
});

// Function to load JSON data from a file
function loadJsonFile(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// Function to fetch data based on the provided position
function fetchData(position) {
	const plannerFilePath = path.join(
		__dirname,
		"../../data/planner/planner.json"
	);
	const plannerData = loadJsonFile(plannerFilePath);

	const nextEntry = plannerData.find(
		(entry) => entry.position === position + 1
	);

	if (!nextEntry) {
		throw new Error(`No planner data found for position ${position + 1}`);
	}

	const dailyDate = nextEntry.daily;

	const dailySPYFilePath = path.join(
		__dirname,
		"../../data/stock/daily_SPY.json"
	);
	const dailySPYData = loadJsonFile(dailySPYFilePath);

	const stockData = dailySPYData["Time Series (Daily)"][dailyDate];

	if (!stockData) {
		throw new Error(`No stock data found for date ${dailyDate}`);
	}

	const gptbLogsFilePath = path.join(
		__dirname,
		"../../data/logs/gptb.logs.json"
	);
	const gptbLogsData = loadJsonFile(gptbLogsFilePath);

	const currentLogEntry = gptbLogsData.find(
		(entry) => entry.position === position
	);

	if (!currentLogEntry) {
		throw new Error(`No GPTB log found for position ${position}`);
	}

	const predictionData = currentLogEntry.data.prediction;

	return { stockData, predictionData, dailyDate };
}

// Function to make an API call to OpenAI to evaluate the prediction
async function evaluatePrediction(stockData, predictionData, dailyDate) {
	const prompt = `You are given a prediction and the actual stock price data for a specific day. Evaluate how accurate the prediction was in terms of the stock price movement (rise or fall), the magnitude of the movement, and any other relevant details.

Stock Data for ${dailyDate}: ${JSON.stringify(stockData)}

Prediction: ${predictionData}

Please provide a detailed analysis comparing the prediction with the actual stock prices. Highlight any aspects where the prediction was accurate, partially accurate, or incorrect. Additionally, discuss the precision of the predicted magnitude of price changes.`;

	const completion = await openai.chat.completions.create({
		model: "gpt-3.5-turbo",
		messages: [
			{
				role: "system",
				content: "You are an expert in stock market analysis.",
			},
			{ role: "user", content: prompt },
		],
	});

	if (!completion || !completion.choices || completion.choices.length === 0) {
		throw new Error("Invalid response structure from API.");
	}

	return completion.choices[0].message.content.trim();
}

// Function to log the evaluation result to a JSON file
function logEvaluationResult(position, dailyDate, evaluation) {
	const logFilePath = path.join(
		__dirname,
		"../../data/logs/eval-gptb.logs.json"
	);

	let logData = [];
	try {
		if (fs.existsSync(logFilePath)) {
			const logFileContents = fs.readFileSync(logFilePath, "utf8");
			if (logFileContents.trim()) {
				logData = JSON.parse(logFileContents);
			}
		}
	} catch (error) {
		if (error.code !== "ENOENT") {
			throw error;
		}
	}

	const newEntry = {
		position: position + 1,
		"current day": dailyDate,
		data: {
			"predict-evaluation": evaluation,
		},
	};

	logData.push(newEntry);

	fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2), {
		encoding: "utf8",
	});
	console.log(
		`Evaluation result logged successfully for position ${
			position + 1
		}, day ${dailyDate}.`
	);
}

// Main function to handle the process
async function main(position) {
	try {
		const { stockData, predictionData, dailyDate } = fetchData(position);

		const evaluation = await evaluatePrediction(
			stockData,
			predictionData,
			dailyDate
		);

		logEvaluationResult(position, dailyDate, evaluation);
	} catch (error) {
		console.error("Error:", error.message);
		process.exit(1);
	}
}

module.exports = { main };
