import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
	resolve: {
		alias: {
			"@honorer/core": path.resolve(__dirname, "src"),
		},
	},
	test: {
		environment: "node",
		exclude: ["dist/**", "**/node_modules/**"],
		// Reduce flakiness by running tests in a single worker
		pool: "threads",
		// Ensure deterministic ordering
		sequence: {
			shuffle: false,
		},
		// Clean up mocks/state between tests
		clearMocks: true,
		mockReset: true,
		restoreMocks: true,
	},
})
