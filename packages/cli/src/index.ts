#!/usr/bin/env node
import { Command } from 'commander'

const program = new Command()

program
  .name('honorer')
  .description('Honorer CLI')
  .version('0.1.0')

program
  .command('hello')
  .description('Print a greeting')
  .argument('[name]', 'Name to greet', 'world')
  .action((name: string) => {
    console.log(`Hello, ${name}!`)
  })

program
  .command('info')
  .description('Show environment info')
  .action(() => {
    console.log(`Node ${process.version} on ${process.platform}/${process.arch}`)
  })

program.parse()
