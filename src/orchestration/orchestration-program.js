// File: src/orchestration/orchestration-program.js

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
const path = require("path");
require("dotenv").config({ path: "../../config/.env" });

// Load the planner file
const plannerData = require(path.resolve(
	__dirname,
	"../../data/planner/planner.json"
));

// Orchestration function to coordinate adaptors
const orchestrateAdaptors = async () => {
	try {
		// Iterate over each entry in the planner
		for (const entry of plannerData) {
			const { position, daily } = entry;

			// Step 1: gpta() processes the news data
			await gpta(position);

			// Step 2: gptb() processes stock data and fetches gpta()'s results
			await gptb(position);

			// Step 3: gptc() analyzes the stock data
			await gptc(position);

			// Step 4: gptd() integrates predictions from gptb() and gptc()
			await gptd(position);

			console.log(
				`Orchestration completed for position ${position}, day ${daily}`
			);
		}
	} catch (error) {
		console.error("Error during orchestration:", error);
	}
};

// Execute the orchestration for all planner entries
(async () => {
	await orchestrateAdaptors();
})();

module.exports = { orchestrateAdaptors };
