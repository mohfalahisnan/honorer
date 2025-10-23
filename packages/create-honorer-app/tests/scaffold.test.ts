import assert from 'node:assert'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
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

test('CLI scaffolds a new honorer app with expected files', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'honorer-create-'))
  const appName = 'test-app'

  const cliTsPath = path.resolve(__dirname, '..', 'src', 'index.ts')
  const tsxModulePath = require.resolve('tsx')
  const tsxModuleUrl = pathToFileURL(tsxModulePath).href
  const res = spawnSync(process.execPath, ['--import=' + tsxModuleUrl, cliTsPath, appName], {
    cwd: tmpRoot,
    stdio: 'pipe',
    encoding: 'utf-8'
  })

  assert.equal(res.status, 0, `CLI exited with ${res.status}. stderr: ${res.stderr}`)

  const targetDir = path.join(tmpRoot, appName)

  const files = [
    'package.json',
    'tsconfig.json',
    'README.md',
    path.join('src', 'index.ts'),
    path.join('src', 'controllers', 'users.controller.ts')
  ]

  for (const f of files) {
    assert.ok(exists(path.join(targetDir, f)), `Expected file missing: ${f}`)
  }

  const pkg = readJSON(path.join(targetDir, 'package.json'))
  assert.ok(pkg.scripts?.start, 'start script missing in package.json')
  assert.ok(pkg.dependencies?.['@honorer/core'], '@honorer/core dependency missing')

  const indexContents = fs.readFileSync(path.join(targetDir, 'src', 'index.ts'), 'utf-8')
  assert.match(indexContents, /serve\(/, 'src/index.ts should start a server using @hono\/node-server')

  // cleanup
  fs.rmSync(tmpRoot, { recursive: true, force: true })
})