# create-honorer-app

Scaffold a new Honorer + Hono TypeScript app in seconds.

## Quick Start
- Node: `>=20.6` (recommended) or `>=18.19`
- Package manager: `pnpm` recommended (works with npm/yarn)

Create a project:
- Using npx: `npx create-honorer-app my-app`
- Using pnpm dlx: `pnpm dlx create-honorer-app my-app`

Then:
- `cd my-app`
- `pnpm install`
- `pnpm start`
- Open `http://localhost:3001/users` and `http://localhost:3001/example`

## What It Generates
- TypeScript app with Hono and `@honorer/core`
- `src/index.ts` booting an HTTP server via `@hono/node-server`
- `UsersController` with a sample `GET /users` route
- Decorator-enabled `tsconfig.json`
- Scripts:
  - `dev`: `tsx watch src/index.ts`
  - `build`: `tsc`
  - `start`: `tsx src/index.ts`

## Usage Notes
- The CLI detects if you run it inside the Honorer monorepo and will set `@honorer/core` to `workspace:*` for local linking; otherwise it pins to a published semver.
- The generated project uses Node ESM and decorators (`experimentalDecorators`, `emitDecoratorMetadata`).

## Local Development (from this repo)
- Build the CLI: `pnpm --filter create-honorer-app run build`
- Run the built JS: `node packages/create-honorer-app/dist/index.js my-app`
- Or run from TS without build: `pnpm --filter create-honorer-app exec tsx src/index.ts my-app`

## Troubleshooting
- "not recognized as a command" when using `npx`:
  - Ensure you are on the latest published version and that the package includes `dist/index.js`.
  - As a fallback, use `pnpm dlx create-honorer-app my-app` or run the built JS locally as shown above.
- "loader" errors on Node v20:
  - Use `--import=tsx` instead of deprecated `--loader tsx`.
- Windows path issues:
  - Prefer `pnpm dlx` or the built JS command if you hit path resolution problems.

## Learn More
- Core library docs: see `packages/core/README.md` in this repo or the `@honorer/core` package README when installed.
- Example app: `apps/example` demonstrates controllers, decorators, validation, DI, and response helpers.

## License
- Part of the Honorer project. See the repository for overall licensing and contribution guidelines.
