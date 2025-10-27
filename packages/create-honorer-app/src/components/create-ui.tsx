import path from "node:path"
import fs from "fs-extra"
import { Box, Text } from "ink"
import SelectInput from "ink-select-input"
import TextInput from "ink-text-input"
import { Fragment, useEffect, useState } from "react"
import { availableTemplates, templatesDir } from "../utils/templates-folder"

export const CreateUI = () => {
	const [step, setStep] = useState<"name" | "template" | "creating" | "done">("name")
	const [projectName, setProjectName] = useState("")
	const [_, setTemplate] = useState("")
	const [message, setMessage] = useState("")

	const handleCreate = async (template: string) => {
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

	useEffect(() => {
		if (step === "done") {
			const t = setTimeout(() => process.exit(0), 1000)
			return () => clearTimeout(t)
		}
	}, [step])

	return (
		<Fragment>
			{step === "name" && (
				<Box flexDirection="column">
					<Text color="cyan">Enter project name:</Text>
					<TextInput value={projectName} onChange={setProjectName} onSubmit={() => setStep("template")} />
				</Box>
			)}

			{step === "template" && (
				<Box flexDirection="column">
					<Text color="cyan">Select template:</Text>
					<SelectInput
						items={availableTemplates}
						onSelect={(item) => {
							console.log("selected item", item.value)
							setTemplate(item.value)
							handleCreate(item.value)
						}}
					/>
				</Box>
			)}

			{step === "creating" && (
				<Box flexDirection="column">
					<Text color="yellow">Creating {projectName}...</Text>
				</Box>
			)}

			{step === "done" && (
				<Box flexDirection="column">
					<Text>{message}</Text>
				</Box>
			)}
		</Fragment>
	)
}
