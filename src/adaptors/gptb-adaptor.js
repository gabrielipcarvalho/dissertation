// File: src/adaptors/gptb-adaptor.js

// Import necessary libraries
const { OpenAI } = require("openai");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config({
	path: path.resolve(__dirname, "../../config/.env"),
});
const ProgressBar = require("progress");

// Configuration using GPTB's specific API key from the .env file
const openai = new OpenAI({
	apiKey: process.env.GPTB_API_KEY,
});

// Function to load the planner file and find the corresponding daily entry for a given position
const getDailyForPosition = async (position) => {
	console.log(
		`Loading planner file to find daily entry for position ${position}...`
	);
	const plannerPath = path.resolve(
		__dirname,
		"../../data/planner/planner.json"
	);
	const plannerData = JSON.parse(await fs.readFile(plannerPath, "utf8"));
	const entry = plannerData.find((item) => item.position === position);

	if (!entry || !entry.daily) {
		throw new Error(`No daily entry found for position ${position}`);
	}

	console.log(`Found daily entry for position ${position}: ${entry.daily}`);
	return entry.daily;
};

// Function to fetch stock price data for the past 30 days from daily_SPY.json
const fetchStockPriceData = async (day) => {
	console.log(
		`Fetching stock price data for the past 30 days until ${day}...`
	);

	const stockPath = path.resolve(
		__dirname,
		"../../data/stock/daily_SPY.json"
	);
	const stockData = JSON.parse(await fs.readFile(stockPath, "utf8"));

	// Extract the index from the day variable (e.g., "1_2024-08-08" -> 1)
	const currentIndex = parseInt(day.split("_")[0]);

	// Calculate the starting index, which can go into negative indices (e.g., -28, -27, ..., 1)
	const startIndex = currentIndex - 29;

	const fetchedData = [];

	// Loop through the range of indices, supporting both negative and positive
	for (let i = startIndex; i <= currentIndex; i++) {
		// Construct the index key (e.g., "-27_2022-05-31", "1_2024-08-08")
		const indexKey = Object.keys(stockData["Time Series (Daily)"]).find(
			(key) => parseInt(key.split("_")[0]) === i
		);

		if (indexKey) {
			const dailyData = stockData["Time Series (Daily)"][indexKey];
			fetchedData.push(dailyData);
		} else {
			console.warn(`Stock price data for index ${i} not found.`);
		}
	}

	if (fetchedData.length === 0) {
		throw new Error(
			`No stock price data found for the past 30 days up to ${day}`
		);
	}

	console.log(`Fetched stock price data for ${fetchedData.length} days.`);
	return fetchedData;
};

// Function to fetch sentiment analysis from gpta.logs.json for a given position
const fetchSentimentAnalysis = async (position) => {
	console.log(`Fetching sentiment analysis for position ${position}...`);
	const logPath = path.resolve(__dirname, "../../data/logs/gpta.logs.json");
	const logData = JSON.parse(await fs.readFile(logPath, "utf8"));

	const filteredLogs = logData.filter((entry) => entry.position === position);

	if (filteredLogs.length === 0) {
		throw new Error(`No GPTA logs found for position ${position}`);
	}

	const sentimentAnalysis = filteredLogs.map((entry) => ({
		sentimentAnalysis: entry.data["sentiment analysis"],
		currentDay: entry["current day"],
	}));

	console.log(`Fetched sentiment analysis for position ${position}`);
	return sentimentAnalysis;
};

// Function to analyze how sentiment and stock prices affected market trends
const analyzeImpactOnStockPrices = async (
	sentimentAnalysis,
	stockPrices,
	day,
	modelName // Accept modelName as parameter
) => {
	console.log(
		`Analyzing impact on stock prices for ${day} using model ${modelName}...`
	);

	const prompt = `Analyse the following sentiment data and historical stock prices (up to 30 days) to assess their combined impact on stock price movements for ${day}. Your analysis should balance the impact of current news sentiment with historical stock price trends, neither overreacting to negative sentiment nor ignoring potential risks. Address the following points concisely within 1500 characters:

1. **Historical Influence**: Examine how past stock price trends and patterns should influence the interpretation of today's sentiment, considering both resilience and vulnerability to news.

2. **Balanced Impact**: Evaluate how today's sentiment could interact with historical trends, considering whether the trends reinforce or mitigate the news impact.

3. **Correlation**: Discuss how news sentiment and stock price changes have correlated historically, without giving undue weight to either, and how this might play out today.

4. **Comparison**: Compare the current day's sentiment and stock price trends with previous days, highlighting any similarities or differences that may inform the analysis.

5. **Anomalies and Exceptions**: Identify any past instances where news sentiment led to unexpected stock movements, focusing on why those anomalies occurred and whether they are relevant today.

Your analysis should reflect a nuanced approach, considering both recent sentiment and long-term historical data to provide a balanced conclusion.`;

	const combinedData = JSON.stringify({
		sentimentAnalysis,
		stockPrices,
	});

	const completion = await openai.chat.completions.create({
		model: modelName, // Use the passed modelName here
		messages: [
			{ role: "system", content: prompt },
			{ role: "user", content: combinedData },
		],
	});

	if (!completion || !completion.choices || completion.choices.length === 0) {
		throw new Error("Invalid response structure from API.");
	}

	const analysisResult = completion.choices[0].message.content.trim();

	console.log("Completed analysis of impact on stock prices.");
	return analysisResult;
};

// Function to log analysis results to gptb.logs.json
const logAnalysisResults = async (position, day, analysis) => {
	console.log(
		`Logging analysis results for position ${position}, day ${day}...`
	);
	const logPath = path.resolve(__dirname, "../../data/logs/gptb.logs.json");

	// Read existing log data
	let logData = [];
	try {
		const logFileContents = await fs.readFile(logPath, "utf8");
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
			analysis,
		},
	});

	// Write the updated log data back to the file
	await fs.writeFile(logPath, JSON.stringify(logData, null, 2), {
		encoding: "utf8",
	});
	console.log(
		`Analysis results logged successfully for position ${position}, day ${day}.`
	);
};

// Function to predict future stock prices based on the analysis
const predictStockPrices = async (analysis, currentDay, modelName) => {
	// Accept modelName as parameter
	const nextDay = `day${parseInt(currentDay.replace("day", "")) + 1}`;
	console.log(
		`Predicting stock prices for ${nextDay} using model ${modelName}...`
	);

	const prompt = `Based on the sentiment analysis and historical stock prices for ${currentDay}, predict the S&P 500 stock prices for ${nextDay}. Ensure that your prediction balances the influence of both historical stock price trends and current sentiment. Avoid overemphasising either one. Provide the prediction in the following format, ensuring the response is within 1500 characters:

Prediction:
- Direction: Raise or Fall?
- Amount: Specify the expected percentage change (e.g., 5%, 1%, 0.5%)
- Confidence: Express the confidence level of this prediction as a percentage (0-100%).

Reasoning: Justify your prediction by considering how historical trends and today's sentiment might interact. Ensure your analysis weighs the news sentiment and historical price trends evenly, providing a well-rounded explanation. Consider market trends, sentiment shifts, up to 30 days of historical data, and any relevant anomalies. Ensure the explanation is concise (within 1500 characters), balanced, and analytical.`;

	const completion = await openai.chat.completions.create({
		model: modelName, // Use the passed modelName here
		messages: [
			{ role: "system", content: prompt },
			{ role: "user", content: analysis },
		],
	});

	if (!completion || !completion.choices || completion.choices.length === 0) {
		throw new Error("Invalid response structure from API.");
	}

	const prediction = completion.choices[0].message.content.trim();
	console.log(`Stock price prediction for ${nextDay} completed.`);
	return prediction;
};

// Function to log prediction results to gptb.logs.json
const logPredictionResults = async (position, day, prediction) => {
	console.log(
		`Logging prediction results for position ${position}, day ${day}...`
	);
	const logPath = path.resolve(__dirname, "../../data/logs/gptb.logs.json");

	// Read existing log data
	let logData = [];
	try {
		const logFileContents = await fs.readFile(logPath, "utf8");
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

	// Find the entry for the current day and update it with the prediction
	const entryIndex = logData.findIndex(
		(entry) => entry.position === position && entry["current day"] === day
	);

	if (entryIndex !== -1) {
		logData[entryIndex].data.prediction = prediction;
	} else {
		logData.push({
			position: position,
			"current day": day,
			data: {
				prediction,
			},
		});
	}

	// Write the updated log data back to the file
	await fs.writeFile(logPath, JSON.stringify(logData, null, 2), {
		encoding: "utf8",
	});
	console.log(
		`Prediction results logged successfully for position ${position}, day ${day}.`
	);
};

// Function to handle the entire GPTB processing
const gptb = async (position, modelName) => {
	// Accept modelName as parameter
	try {
		console.log(
			`Starting GPTB processing for position ${position} using model ${modelName}...`
		);

		const day = await getDailyForPosition(position);
		const stockPrices = await fetchStockPriceData(day);
		const sentimentAnalysis = await fetchSentimentAnalysis(position);

		const analysis = await analyzeImpactOnStockPrices(
			sentimentAnalysis,
			stockPrices,
			day,
			modelName // Pass modelName to analysis function
		);
		await logAnalysisResults(position, day, analysis);

		const prediction = await predictStockPrices(analysis, day, modelName); // Pass modelName to prediction function
		await logPredictionResults(position, day, prediction);

		console.log(`GPTB processing completed for position ${position}.`);
	} catch (error) {
		console.error(`Error in GPTB for position ${position}:`, error);
		throw error;
	}
};

// Export the gptb function so it can be used in other files
module.exports = {
	gptb,
};
