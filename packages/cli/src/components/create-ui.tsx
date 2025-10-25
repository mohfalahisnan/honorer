import path from "node:path"
import fs from "fs-extra"
import { Box, Text } from "ink"
import SelectInput from "ink-select-input"
import TextInput from "ink-text-input"
import React, { useState } from "react"

export const CreateUI = () => {
	const [step, setStep] = useState<"name" | "template" | "creating" | "done">("name")
	const [projectName, setProjectName] = useState("")
	const [template, setTemplate] = useState("")
	const [message, setMessage] = useState("")

	const templatesDir = path.resolve(process.cwd(), "src/templates")
	const availableTemplates = fs
		.readdirSync(templatesDir)
		.filter((f) => fs.statSync(path.join(templatesDir, f)).isDirectory())
		.map((t) => ({ label: t, value: t }))

	const handleCreate = async () => {
		setStep("creating")
		try {
			const templateDir = path.join(templatesDir, template)
			const targetDir = path.resolve(process.cwd(), projectName)
			await fs.copy(templateDir, targetDir, { overwrite: false })
			setMessage(`✅ Created ${projectName} from ${template}`)
			setStep("done")
		} catch (err) {
			setMessage(`❌ Error: ${(err as Error).message}`)
			setStep("done")
		}
	}

	if (step === "name")
		return (
			<Box>
				<Box borderStyle="classic">
					<Text>Create Hono + @honorer/core</Text>
				</Box>
				<Box flexDirection="column">
					<Text color="cyan">Enter project name:</Text>
					<TextInput value={projectName} onChange={setProjectName} onSubmit={() => setStep("template")} />
				</Box>
			</Box>
		)

	if (step === "template")
		return (
			<Box flexDirection="column">
				<Text color="cyan">Select template:</Text>
				<SelectInput
					items={availableTemplates}
					onSelect={(item) => {
						setTemplate(item.value)
						handleCreate()
					}}
				/>
			</Box>
		)

	if (step === "creating")
		return (
			<Box flexDirection="column">
				<Text color="yellow">Creating {projectName}...</Text>
			</Box>
		)

	if (step === "done")
		return (
			<Box flexDirection="column">
				<Text>{message}</Text>
			</Box>
		)

	return null
}
