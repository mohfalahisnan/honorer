import path from "node:path"
import fs from "fs-extra"
import { Box, Text } from "ink"
import SelectInput from "ink-select-input"
import { Fragment, useEffect, useState } from "react"
import { availableAddTemplates, templatesAddDir } from "../utils/templates-folder"

export const AddUI = () => {
	const [step, setStep] = useState<"template" | "creating" | "done">("template")
	const [projectName, setProjectName] = useState("")
	const [_, setTemplate] = useState("")
	const [message, setMessage] = useState("")

	const handleAdd = async (template: string) => {
		setStep("creating")
		try {
			const templateDir = path.join(templatesAddDir, template)
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
			{step === "template" && (
				<Box flexDirection="column">
					<Text color="cyan">Select template:</Text>
					<SelectInput
						items={availableAddTemplates}
						onSelect={(item) => {
							console.log("selected item", item.value)
							setTemplate(item.value)
							handleAdd(item.value)
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
