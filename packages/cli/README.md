# @honorer/cli

A simple command-line interface for the Honorer monorepo.

## Development

- Build: `pnpm --filter @honorer/cli run build`
- Dev (watch): `pnpm --filter @honorer/cli run dev`
- Start: `pnpm --filter @honorer/cli run start`

## Usage

After building:

- `pnpm --filter @honorer/cli exec node dist/index.js hello`
- `pnpm --filter @honorer/cli exec node dist/index.js info`

When published or linked globally, use the bin:

- `honorer hello [name]`
- `honorer info`
