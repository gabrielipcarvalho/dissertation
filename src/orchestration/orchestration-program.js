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

const { main: evalGptb } = require("../eval_adaptors/eval-gptb");
const { main: evalGptc } = require("../eval_adaptors/eval-gptc");
const { main: evalGptd } = require("../eval_adaptors/eval-gptd");

require("dotenv").config({ path: "../../config/.env" });

// Load the planner file
const plannerData = require(path.resolve(
	__dirname,
	"../../data/planner/planner.json"
));

// Orchestration function to coordinate adaptors
const orchestrateAdaptors = async () => {
	try {
		// Iterate over each entry in the planner except the last one
		for (let i = 0; i < plannerData.length - 1; i++) {
			const { position, daily } = plannerData[i];

			// Step 1: gpta() processes the news data
			await gpta(position);

			// Step 2: gptb() processes stock data and fetches gpta()'s results
			await gptb(position);

			// Step 3: gptc() analyzes the stock data
			await gptc(position);

			// Step 4: gptd() integrates predictions from gptb() and gptc()
			await gptd(position);

			// Step 5: eval-gptb() evaluates the predictions made by GPTB
			await evalGptb(position);

			// Step 6: eval-gptc() evaluates the predictions made by GPTC
			await evalGptc(position);

			// Step 7: eval-gptd() evaluates the predictions made by GPTD
			await evalGptd(position);

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
