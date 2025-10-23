#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

function log(msg: string) {
	console.log(msg)
}

function writeJSON(filePath: string, obj: any) {
	fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

function ensureDir(dir: string) {
	fs.mkdirSync(dir, { recursive: true })
}

function scaffoldApp(targetDir: string, appName: string) {
	ensureDir(targetDir)

	// Detect monorepo core presence for workspace linking
	const monorepoCore = fs.existsSync(path.resolve(process.cwd(), 'packages/core'))
	const coreDep = monorepoCore ? 'workspace:*' : '^0.1.1'

	// package.json
	const appPkg = {
		name: appName,
		private: true,
		type: 'module',
		scripts: {
			dev: 'tsx watch src/index.ts',
			build: 'tsc',
			start: 'tsx src/index.ts',
		},
		dependencies: {
			'@honorer/core': coreDep,
			'@hono/node-server': '^1.19.5',
			hono: '^4.10.2',
		},
		devDependencies: {
			'@types/node': '^20.11.17',
			tsx: '^4.7.1',
			typescript: '^5.8.3',
		},
	}
	writeJSON(path.join(targetDir, 'package.json'), appPkg)

	// tsconfig.json
	const tsconfig = {
		compilerOptions: {
			target: 'ESNext',
			module: 'ESNext',
			moduleResolution: 'Bundler',
			strict: true,
			skipLibCheck: true,
			verbatimModuleSyntax: true,
			experimentalDecorators: true,
			emitDecoratorMetadata: true,
			types: ['node'],
			outDir: './dist',
		},
		exclude: ['node_modules'],
	}
	writeJSON(path.join(targetDir, 'tsconfig.json'), tsconfig)

	// src/index.ts
	ensureDir(path.join(targetDir, 'src'))
	const indexTs = `import { serve } from '@hono/node-server'
import { createApp } from '@honorer/core'
import { UsersController } from './controllers/users.controller'

const app = createApp([UsersController])

app.get('/example', (c) => c.json({ ok: true, message: 'Using @honorer/core' }))

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(\`App running on http://localhost:\${info.port}\`)
})
`
	fs.writeFileSync(path.join(targetDir, 'src', 'index.ts'), indexTs, 'utf8')

	// src/controllers/users.controller.ts
	ensureDir(path.join(targetDir, 'src', 'controllers'))
	const usersControllerTs = `import { Controller, Get, Injectable } from '@honorer/core'
import type { Context } from 'hono'

@Injectable
@Controller('/users')
export class UsersController {
  @Get('/')
  list(c: Context) {
    return c.json([{ id: '1', name: 'Ada' }])
  }
}
`
	fs.writeFileSync(path.join(targetDir, 'src', 'controllers', 'users.controller.ts'), usersControllerTs, 'utf8')

	// README.md
	const readme = `# ${appName}\n\nScaffolded by create-honorer-app.\n\n## Quick start\n\n- Install deps: \`pnpm install\` (or \`npm install\`)\n- Dev: \`pnpm dev\`\n- Start: \`pnpm start\`\n- Visit: \`http://localhost:3001/users\` and \`/example\`\n`
	fs.writeFileSync(path.join(targetDir, 'README.md'), readme, 'utf8')
}

function main() {
	const args = process.argv.slice(2)
	const rawName = args[0] || 'honorer-app'
	const appName = rawName.replace(/[^a-zA-Z0-9-_]/g, '-')
	const targetDir = path.resolve(process.cwd(), rawName)

	if (fs.existsSync(targetDir)) {
		const files = fs.readdirSync(targetDir)
		if (files.length > 0) {
			log(`\u26A0\uFE0F  Target directory '${rawName}' already exists and is not empty.`)
			process.exitCode = 1
			return
		}
	}

	scaffoldApp(targetDir, appName)

	log(`\n\u2705 Project created at: ${targetDir}`)
	log(`\nNext steps:`)
	log(`  cd ${rawName}`)
	log(`  pnpm install`) // or npm install
	log(`  pnpm dev`) // starts dev server
}

main()
