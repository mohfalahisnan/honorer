import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Always resolve relative to your package location, not user's cwd
const templatesDir =
	process.env.NODE_ENV === "production"
		? path.resolve(__dirname, "../templates") // when built to dist/
		: path.resolve(__dirname, "../../templates") // when running from src/

const availableTemplates = fs
	.readdirSync(templatesDir)
	.filter((f) => fs.statSync(path.join(templatesDir, f)).isDirectory())
	.map((t) => ({ label: t, value: t }))

export { templatesDir, availableTemplates }
