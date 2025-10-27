import { Box, render, Text } from "ink"
import SelectInput from "ink-select-input"
import { AddUI } from "./add-ui"
import { CreateUI } from "./create-ui"
import { GenerateUI } from "./generate-ui"

const items = [
	{
		label: "New Project",
		value: "new",
		element: <CreateUI />,
	},
	{
		label: "Add Template",
		value: "add",
		element: <AddUI />,
	},
	{
		label: "Generate",
		value: "generate",
		element: <GenerateUI />,
	},
]

export const MainUI = () => {
	return (
		<Box display="flex" flexDirection="column">
			<Box display="flex" flexDirection="column" marginBottom={1}>
				<Text bold color={"blueBright"}>
					Honorer CLI
				</Text>
				<Text color="blueBright" dimColor italic>
					Create your next project with Honorer!
				</Text>
			</Box>
			<Box>
				<Text color="cyan">Select Action :</Text>
				<SelectInput
					items={items}
					onSelect={(item) => {
						render(items.find((i) => i.value === item.value)?.element || null)
					}}
				/>
			</Box>
		</Box>
	)
}
