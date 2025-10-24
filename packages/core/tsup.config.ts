import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	sourcemap: true,
	clean: true,
	target: 'es2020',
	platform: 'neutral',
	outDir: 'dist',
	treeshake: true,
	minify: false,
	tsconfig: 'tsconfig.tsup.json',
	// Do not bundle peer deps; keep them external for consumers
	external: ['hono', '@hono/node-server', 'zod', 'reflect-metadata', 'kysely'],
})
