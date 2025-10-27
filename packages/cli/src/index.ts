#!/usr/bin/env node
import { Command } from "commander"
import { render } from "ink"
import React from "react"
import { CreateUI } from "./components/create-ui"

const program = new Command()

program.name("honorer").description("Honorer CLI").version("0.1.0")

program
	.command("create")
	.description("Interactive project creator")
	.action(() => {
		render(React.createElement(CreateUI))
	})

program.parse()
