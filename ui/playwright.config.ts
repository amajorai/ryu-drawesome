import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const appRoot = import.meta.dirname;
const baseURL = "http://127.0.0.1:5842";

export default defineConfig({
	testDir: path.resolve(appRoot, "e2e"),
	testMatch: "drawesome-sketch-workflow.spec.ts",
	fullyParallel: false,
	workers: 1,
	reporter: "list",
	use: {
		...devices["Desktop Chrome"],
		baseURL,
		viewport: { width: 1440, height: 960 },
	},
	webServer: {
		command: "bunx vite --host 127.0.0.1 --port 5842 --strictPort",
		cwd: appRoot,
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
