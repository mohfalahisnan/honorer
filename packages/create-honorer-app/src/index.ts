#!/usr/bin/env node
import { Command } from "commander"
import { render } from "ink"
import React from "react"
import { AddUI } from "./components/add-ui"
import { CreateUI } from "./components/create-ui"
import { MainUI } from "./components/main"

const program = new Command()

program.name("honorer").description("Honorer CLI").version("0.1.0")

program
	.command("create")
	.description("Create a new Honorer project")
	.action(() => {
		render(React.createElement(CreateUI))
	})

program
	.command("add")
	.description("Add a new component to the project")
	.action(() => {
		render(React.createElement(AddUI))
	})

// check if user provided any command args
if (process.argv.length <= 2) {
	// no command: run default `create`
	render(React.createElement(MainUI))
} else {
	program.parse(process.argv)
}
