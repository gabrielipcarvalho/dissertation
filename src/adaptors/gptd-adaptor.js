// File: gptd-adaptor.js

const { OpenAI } = require("openai");
const fs = require("fs").promises;
require("dotenv").config();

// Configuration using GPTD's specific API key from the .env file
const openai = new OpenAI({
	apiKey: process.env.GPTD_API_KEY,
});

// Function to read JSON data from a file
const readJSONData = async (filename) => {
	const filePath = `Data/${filename}`;
	try {
		const dataJson = await fs.readFile(filePath, { encoding: "utf8" });
		return JSON.parse(dataJson);
	} catch (error) {
		console.error(`Error reading JSON file: ${filePath}`, error);
		throw error;
	}
};

// Function to integrate and analyze predictions from GPTB and GPTC
const integrateAndAnalyzePredictions = async (day) => {
	try {
		const nextDay = `day${parseInt(day.replace("day", "")) + 1}`;
		const gptbPredictionData = await readJSONData(
			`log.GPTB.prediction.${nextDay}.json`
		);
		const gptcAnalysisData = await readJSONData(
			`log.GPTC.${day}.analysis.json`
		);

		const prompt = `Integrate and analyze predictions from GPTB and GPTC for Day ${day}, assessing the alignment and discrepancies between the two forecasts. Ensure the analysis highlights key points of agreement and divergence between the models, providing a comprehensive understanding of their predictions. Predictions from GPTB: ${JSON.stringify(
			gptbPredictionData.prediction
		)}, Predictions from GPTC: ${JSON.stringify(gptcAnalysisData)}.`;

		const completion = await openai.chat.completions.create({
			model: "gpt-3.5-turbo",
			messages: [
				{
					role: "system",
					content:
						"Synthesize the information from GPTB and GPTC models to provide a cohesive analysis. Your analysis should integrate insights from both models, highlighting areas of agreement and divergence, and explain the implications for stock price movements. Ensure the analysis is detailed and includes quantitative assessments where possible.",
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
		await fs.writeFile(
			`Data/log.GPTD.${day}.analysis.json`,
			JSON.stringify({ combinedAnalysis }, null, 2),
			{ encoding: "utf8" }
		);

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
const makeFinalPrediction = async (day) => {
	try {
		const analysisData = await readJSONData(
			`log.GPTD.${day}.analysis.json`
		);

		const nextDay = `day${parseInt(day.replace("day", "")) + 1}`;
		const prompt = `Based on the integrated analysis from Day ${day}, synthesize insights to make a final, comprehensive prediction for ${nextDay} stock prices. Your prediction should clearly state whether stock prices are expected to rise or fall, by how much, and the reasoning behind your forecast. Ensure the prediction is quantitative, specifying the expected percentage change or price range. Consider historical trends, recent market behaviour, and any notable anomalies in the data. Analysis data: ${JSON.stringify(
			analysisData
		)}.`;

		const completion = await openai.chat.completions.create({
			model: "gpt-3.5-turbo",
			messages: [
				{
					role: "system",
					content:
						"Provide a detailed forecast using the integrated analysis from GPTB and GPTC. Your forecast should clearly state whether stock prices will rise or fall, by how much, and include the reasoning behind your prediction. Ensure the forecast is actionable and precise, enabling validation against actual market outcomes. I repeate, you must state a percentage and if it is going to rise or fall, this is not an option, it is a necessity, you must draw from what you read the conclusion of a rise or fall on prices and by exactly how much.",
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
		await fs.writeFile(
			`Data/log.GPTD.${nextDay}.prediction.json`,
			JSON.stringify({ finalPrediction }, null, 2),
			{ encoding: "utf8" }
		);

		return finalPrediction;
	} catch (error) {
		console.error("Error making final prediction for stock prices:", error);
		throw error;
	}
};

// Export functions to be used by the orchestration program
module.exports = {
	integrateAndAnalyzePredictions,
	makeFinalPrediction,
};
