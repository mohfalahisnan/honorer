import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

function exists(p: string) {
	return fs.existsSync(p)
}

function readJSON(p: string) {
	return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

describe('create-honorer-app', () => {
	it('CLI scaffolds a new honorer app with expected files', () => {
		const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'honorer-create-'))
		const appName = 'test-app'

		// Point to TS entry under src/index.ts
		const cliTsPath = path.resolve(__dirname, '..', 'index.ts')
		const tsxModulePath = require.resolve('tsx')
		const tsxModuleUrl = pathToFileURL(tsxModulePath).href
		const res = spawnSync(process.execPath, ['--import=' + tsxModuleUrl, cliTsPath, appName], {
			cwd: tmpRoot,
			stdio: 'pipe',
			encoding: 'utf-8',
		})

		expect(res.status).toBe(0)

		const targetDir = path.join(tmpRoot, appName)

		const files = [
			'package.json',
			'tsconfig.json',
			'README.md',
			path.join('src', 'index.ts'),
			path.join('src', 'controllers', 'users.controller.ts'),
		]

		for (const f of files) {
			expect(exists(path.join(targetDir, f))).toBe(true)
		}

		const pkg = readJSON(path.join(targetDir, 'package.json'))
		expect(pkg.scripts?.start).toBeDefined()
		expect(pkg.dependencies?.['@honorer/core']).toBeDefined()

		const indexContents = fs.readFileSync(path.join(targetDir, 'src', 'index.ts'), 'utf-8')
		expect(indexContents).toMatch(/serve\(/)

		// cleanup
		fs.rmSync(tmpRoot, { recursive: true, force: true })
	})
})
