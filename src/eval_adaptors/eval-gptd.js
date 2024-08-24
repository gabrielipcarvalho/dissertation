const fs = require("fs/promises");
const path = require("path");
const { OpenAI } = require("openai");
require("dotenv").config({
	path: path.resolve(__dirname, "../../config/.env"),
});

// Configuration using GPTD's specific API key from the .env file
const openai = new OpenAI({
	apiKey: process.env.GPTD_API_KEY,
});

// Function to load JSON data from a file
async function loadJsonFile(filePath) {
	try {
		const fileContents = await fs.readFile(filePath, "utf8");
		return JSON.parse(fileContents);
	} catch (error) {
		console.error(`Error loading JSON from file ${filePath}:`, error);
		throw error;
	}
}

// Function to fetch data based on the provided position
async function fetchData(position) {
	console.log(`Fetching data for position: ${position}`);

	const plannerFilePath = path.join(
		__dirname,
		"../../data/planner/planner.json"
	);
	const plannerData = await loadJsonFile(plannerFilePath);

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
	const dailySPYData = await loadJsonFile(dailySPYFilePath);
	const stockData = dailySPYData["Time Series (Daily)"][dailyDate];
	if (!stockData) {
		throw new Error(`No stock data found for date ${dailyDate}`);
	}

	const gptdLogsFilePath = path.join(
		__dirname,
		"../../data/logs/gptd.logs.json"
	);
	const gptdLogsData = await loadJsonFile(gptdLogsFilePath);
	const currentLogEntry = gptdLogsData.find(
		(entry) => entry.position === position
	);
	if (!currentLogEntry) {
		throw new Error(`No GPTD log found for position ${position}`);
	}

	return {
		stockData,
		predictionData: currentLogEntry.data.prediction,
		dailyDate,
	};
}

// Function to make an API call to OpenAI to evaluate the prediction
async function evaluatePrediction(stockData, predictionData, dailyDate) {
	const prompt = `You are an expert in stock market analysis. Given the following prediction and actual stock price data for the specified day, please evaluate how accurate the prediction was. Compare the direction of the movement (rise or fall) and the magnitude of the movement (percentage change). Highlight any areas where the prediction was accurate, partially accurate, or incorrect.

Stock Data for ${dailyDate}:
Direction: ${stockData["6. direction"]}
Amount: ${stockData["7. amount"]}

Prediction: ${predictionData}

Please provide a detailed analysis comparing the prediction with the actual stock prices.`;

	console.log(`Sending API request for prediction evaluation.`);
	const completion = await openai.chat.completions.create({
		model: "gpt-4o",
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

// Function to make a second API call to generate structured JSON-like data
async function generateJsonResponse(predictionData) {
	const prompt = `You are an expert in data analysis, tasked with extracting specific information from a text-based prediction.

Prediction: ${predictionData}

1. **Prediction Data**: The provided prediction compares predictions made by others and then it outputs a final prediction, this final prediction data contains a directional forecast (either "rise" or "fall") and a magnitude of change (a percentage value).

2. **Task**:
   - **Extract the Direction**: Identify whether the prediction suggests a "rise" or "fall" in stock price.
   - **Extract the Amount**: Determine the exact percentage change predicted.
   - **Ensure Accuracy**: The extracted values must directly match the intent and wording of the prediction data.
   - **Fill the JSON**: Insert these extracted values into the 'gptd' section of the JSON object under 'direction' and 'amount'.

3. **Format**:
   - Return **only** the JSON object as specified below.
   - **No Additional Text**: Do not include any explanations, introductions, or formatting like markdown.
   - The output must be valid JSON that can be parsed directly.

Below is the JSON structure to fill:

{
  "gptd": {
    "direction": "Extracted direction",
    "amount": "Extracted percentage"
  }
}

**Important**: Only return the filled JSON object. No other text or formatting should be included.`;

	console.log(`Sending API request for structured JSON response.`);
	const completion = await openai.chat.completions.create({
		model: "gpt-4o",
		messages: [{ role: "user", content: prompt }],
	});

	if (!completion || !completion.choices || completion.choices.length === 0) {
		throw new Error("Invalid response structure from API.");
	}

	// Strip backticks and any other unwanted characters or explanations
	const cleanedResponse = completion.choices[0].message.content
		.replace(/```json|```/g, "") // Remove markdown code block backticks
		.trim();

	try {
		// Try parsing the cleaned response to ensure it's valid JSON
		const partialJson = JSON.parse(cleanedResponse);
		return partialJson;
	} catch (error) {
		throw new Error(
			"Received response is not valid JSON: " + cleanedResponse
		);
	}
}

// Function to log the evaluation result to a JSON file
async function logEvaluationResult(position, dailyDate, evaluation) {
	console.log(
		`Logging evaluation result for position ${
			position + 1
		}, date ${dailyDate}`
	);
	const logFilePath = path.join(
		__dirname,
		"../../data/logs/eval-gptd.logs.json"
	);

	let logData = [];
	try {
		// Try to read the existing log file
		try {
			const logFileContents = await fs.readFile(logFilePath, "utf8");
			if (logFileContents.trim()) {
				logData = JSON.parse(logFileContents);
			}
		} catch (error) {
			if (error.code !== "ENOENT") {
				throw error; // Rethrow if error is not related to file non-existence
			}
			console.log("Log file not found, creating a new one.");
		}

		const newEntry = {
			position: position + 1,
			"current day": dailyDate,
			data: {
				"predict-evaluation": evaluation,
			},
		};

		logData.push(newEntry);
		await fs.writeFile(
			logFilePath,
			JSON.stringify(logData, null, 2),
			"utf8"
		);
		console.log(
			`Evaluation result logged successfully for position ${
				position + 1
			}, date ${dailyDate}`
		);
	} catch (error) {
		console.error("Error logging evaluation result:", error);
	}
}

// Function to log the structured JSON data into eval.logs.json
async function logJsonResponse(position, dailyDate, jsonResponse) {
	console.log(
		`Logging JSON response for position ${position + 1}, date ${dailyDate}`
	);
	const logFilePath = path.join(__dirname, "../../data/logs/eval.logs.json");

	let logData = [];
	try {
		// Try to read the existing log file
		try {
			const logFileContents = await fs.readFile(logFilePath, "utf8");
			if (logFileContents.trim()) {
				logData = JSON.parse(logFileContents);
			}
		} catch (error) {
			if (error.code !== "ENOENT") {
				console.error("Error reading JSON log file:", error.message);
				throw error;
			}
			console.log("Log file not found, creating a new one.");
		}

		let parsedJsonResponse = JSON.parse(jsonResponse); // Ensure JSON response is valid

		// Find the relevant log entry by position
		const targetIndex = logData.findIndex(
			(entry) => entry.position === position + 1
		);

		if (targetIndex !== -1) {
			// Insert the gptd response below gptc and above outcome
			const existingEntry = logData[targetIndex];
			logData[targetIndex] = {
				...existingEntry,
				gptd: {
					...parsedJsonResponse.gptd,
				},
				outcome: existingEntry.outcome, // Keep the outcome in its original place
			};
		} else {
			console.error(`Log entry for position ${position + 1} not found.`);
			return;
		}

		await fs.writeFile(
			logFilePath,
			JSON.stringify(logData, null, 2),
			"utf8"
		);
		console.log(
			`JSON response logged successfully for position ${
				position + 1
			}, date ${dailyDate}`
		);
	} catch (error) {
		console.error("Error writing JSON log file:", error.message);
	}
}

// Main function to handle the process
async function main(position) {
	console.log(`Starting main process for position ${position}`);
	try {
		// Step 2: Fetch the stock data, prediction data, and daily date
		const { stockData, predictionData, dailyDate } = await fetchData(
			position
		);

		// Step 5: Evaluate the prediction using the GPTD model
		const evaluation = await evaluatePrediction(
			stockData,
			predictionData,
			dailyDate
		);
		await logEvaluationResult(position, dailyDate, evaluation);

		// Step 7: Generate the JSON-like structure from the prediction data
		const gptdResponse = await generateJsonResponse(predictionData);
		console.log(gptdResponse);

		// Step 8: Complete the JSON with the relevant position, date, and outcome
		const completeJson = {
			position: position + 1,
			date: dailyDate,
			gptd: {
				...gptdResponse.gptd,
			},
			outcome: {
				direction: stockData["6. direction"],
				amount: stockData["7. amount"],
			},
		};

		// Step 9 & 10: Log the complete JSON response in the eval.logs.json file
		await logJsonResponse(
			position,
			dailyDate,
			JSON.stringify(completeJson)
		);
	} catch (error) {
		console.error("Error during main process:", error.message);
		process.exit(1);
	}
}

module.exports = { main };
