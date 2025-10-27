import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isRunningFromNodeModules = __dirname.includes("node_modules")

const templatesDir = isRunningFromNodeModules
	? path.resolve(__dirname, "../templates") // npx or global install
	: path.resolve(__dirname, "../../templates") // local dev

const templatesAddDir = isRunningFromNodeModules
	? path.resolve(__dirname, "../templates") // npx or global install
	: path.resolve(__dirname, "../../templates") // local dev

const availableTemplates = fs
	.readdirSync(templatesDir)
	.filter((f) => fs.statSync(path.join(templatesDir, f)).isDirectory())
	.map((t) => ({ label: t, value: t }))

const availableAddTemplates = fs
	.readdirSync(templatesAddDir)
	.filter((f) => fs.statSync(path.join(templatesAddDir, f)).isDirectory())
	.map((t) => ({ label: t, value: t }))

export { templatesDir, availableTemplates, availableAddTemplates, templatesAddDir }
