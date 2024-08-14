// File: src/planner/execute.js

const { createPlanner } = require("./index");

async function runPlanner() {
	try {
		console.log("Starting planner execution...");
		await createPlanner();
		console.log("Planner execution completed successfully.");
	} catch (error) {
		console.error("Error executing planner:", error);
	}
}

// Execute the planner
runPlanner();
