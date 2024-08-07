const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

// Define paths to the JSON files using environment variables
const dailyPath = process.env.DAILY_PATH;
const weeklyPath = process.env.WEEKLY_PATH;
const monthlyPath = process.env.MONTHLY_PATH;
const newsPath = process.env.NEWS_PATH;
const plannerPath = process.env.PLANNER_PATH;

async function readJSON(filePath) {
	try {
		console.log(`Reading JSON file from path: ${filePath}`);
		const data = await fs.readFile(filePath, "utf8");
		console.log(`Successfully read JSON file from path: ${filePath}`);
		return JSON.parse(data);
	} catch (error) {
		console.error(`Error reading JSON file from path: ${filePath}`, error);
		throw error;
	}
}

function formatDate(dateStr) {
	const [year, month, day] = dateStr.split("-");
	return `${year}-${month}-${day}`;
}

async function createPlanner() {
	try {
		console.log("Starting to create planner...");

		const dailyData = await readJSON(dailyPath);
		const weeklyData = await readJSON(weeklyPath);
		const monthlyData = await readJSON(monthlyPath);
		const newsData = await readJSON(newsPath);

		const dailySeries = dailyData["Time Series (Daily)"];
		const weeklySeries = weeklyData["Weekly Time Series"];
		const monthlySeries = monthlyData["Monthly Time Series"];

		const planner = [];
		let lastNewsDate = null;

		const newsEntriesArray = Object.entries(newsData);

		for (const [dailyKey, dailyValue] of Object.entries(dailySeries)) {
			console.log(`Processing daily entry: ${dailyKey}`);
			const position = dailyKey.split("_")[0];
			const dailyDate = dailyKey.split("_")[1];
			const formattedDate = formatDate(dailyDate);
			const entry = { position: parseInt(position), daily: dailyKey };

			// Include weekly data if it matches the daily date
			const weeklyKey = Object.keys(weeklySeries).find(
				(key) => key.split("_")[1] === dailyDate
			);
			if (weeklyKey) {
				entry.weekly = weeklyKey;
				console.log(`Including weekly entry: ${weeklyKey}`);
			}

			// Include monthly data if it matches the daily date
			const monthlyKey = Object.keys(monthlySeries).find(
				(key) => key.split("_")[1] === dailyDate
			);
			if (monthlyKey) {
				entry.monthly = monthlyKey;
				console.log(`Including monthly entry: ${monthlyKey}`);
			}

			// Include news data up to the current daily date
			const newsEntries = [];
			for (const [newsKey, newsValue] of newsEntriesArray) {
				const newsDate = newsKey.split("_").slice(1).join("-");
				const formattedNewsDate = formatDate(newsDate);
				if (
					(lastNewsDate === null ||
						new Date(formattedNewsDate) > new Date(lastNewsDate)) &&
					new Date(formattedNewsDate) <= new Date(formattedDate)
				) {
					newsEntries.push(newsKey);
				}
			}
			entry.news = newsEntries.join(", ");
			console.log(`Including news entries: ${entry.news}`);

			// Update lastNewsDate to the latest included news date
			if (newsEntries.length > 0) {
				lastNewsDate = newsEntries[newsEntries.length - 1]
					.split("_")
					.slice(1)
					.join("-");
			}

			planner.push(entry);
		}

		await fs.writeFile(
			plannerPath,
			JSON.stringify(planner, null, 2),
			"utf8"
		);
		console.log("Planner JSON file created successfully");
	} catch (error) {
		console.error("Error creating planner:", error);
		throw error;
	}
}

// Export the createPlanner function
module.exports = { createPlanner };

// Run the createPlanner function
createPlanner().catch((error) => {
	console.error("Error creating planner:", error);
});
