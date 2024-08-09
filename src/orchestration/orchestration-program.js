// File: orchestration_program.js

// Import necessary libraries and adaptors
const {
	collectAndLogNews,
	extractKeyInformation,
	executeSentimentAnalysis,
} = require("./gpta_adaptor");
const {
	readAndValidateData,
	readStockPriceData: readBStockPriceData,
	analyzeImpactOnStockPrices,
	predictStockPrices,
} = require("./gptb_adaptor");
const {
	readStockPriceData: readCStockPriceData,
	analyzeStockPricesWithGPT,
} = require("./gptc_adaptor");
const {
	integrateAndAnalyzePredictions,
	makeFinalPrediction,
} = require("./gptd_adaptor");
const fs = require("fs").promises;
require("dotenv").config();

// Orchestration function to coordinate adaptors
const orchestrateAdaptors = async (day) => {
	try {
		// Step 1: GPTA collects and processes news data
		const newsData = await collectAndLogNews(day);
		const extractedInfo = await extractKeyInformation(newsData, day);
		const sentimentAnalysis = await executeSentimentAnalysis(
			extractedInfo,
			day
		);

		// Log outputs from GPTA for verification and further use
		const logDataGPTA = {
			extractedInformation: extractedInfo,
			sentimentAnalysis: sentimentAnalysis,
		};
		await fs.writeFile(
			`Data/log.GPTA.${day}.output.json`,
			JSON.stringify(logDataGPTA, null, 2),
			{ encoding: "utf8" }
		);

		// Step 2: GPTB reads the data validated by GPTA and analyses impact
		const extractedInfoData = await readAndValidateData(
			`log.GPTA.${day}.output.json`
		);
		const stockPricesDataB = await readBStockPriceData(
			`prices-data-${day}.txt`
		);

		// Analyze the impact on stock prices using GPTB
		const impactAnalysisB = await analyzeImpactOnStockPrices(
			extractedInfoData.extractedInformation,
			extractedInfoData.sentimentAnalysis,
			stockPricesDataB,
			day
		);
		await fs.writeFile(
			`Data/log.GPTB.${day}.impact.json`,
			JSON.stringify({ impactAnalysis: impactAnalysisB }, null, 2),
			{ encoding: "utf8" }
		);

		// Step 3: GPTB makes a prediction based on its analysis
		const predictionDay = `day${parseInt(day.replace("day", "")) + 1}`;
		const predictionB = await predictStockPrices(
			impactAnalysisB,
			predictionDay
		);
		await fs.writeFile(
			`Data/log.GPTB.prediction.${predictionDay}.json`,
			JSON.stringify({ prediction: predictionB }, null, 2),
			{ encoding: "utf8" }
		);

		// Step 4: GPTC reads and analyses the raw stock price data
		const stockPricesDataC = await readCStockPriceData(
			`prices-data-${day}.txt`
		);
		const impactAnalysisC = await analyzeStockPricesWithGPT(
			stockPricesDataC
		);
		await fs.writeFile(
			`Data/log.GPTC.${day}.analysis.json`,
			JSON.stringify({ impactAnalysis: impactAnalysisC }, null, 2),
			{ encoding: "utf8" }
		);

		// Step 5: GPTD integrates and analyzes predictions from GPTB and GPTC, then makes a final prediction
		const integratedAnalysis = await integrateAndAnalyzePredictions(day);
		const finalPrediction = await makeFinalPrediction(day);
		await fs.writeFile(
			`Data/log.GPTD.${predictionDay}.prediction.json`,
			JSON.stringify({ finalPrediction }, null, 2),
			{ encoding: "utf8" }
		);

		console.log(`Orchestration completed for ${day}`);
	} catch (error) {
		console.error("Error during orchestration:", error);
	}
};

// Example usage to orchestrate operations for a specific day
(async () => {
	const day = "day0"; // Specify the day for processing
	await orchestrateAdaptors(day);
})();

module.exports = { orchestrateAdaptors };
