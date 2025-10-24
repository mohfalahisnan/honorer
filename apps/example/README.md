# @honorer/example

Demonstrates how to import and extend the app from `@honorer/core`.

## Development

- Build: `pnpm --filter @honorer/example run build`
- Dev (watch): `pnpm --filter @honorer/example run dev`
- Start: `pnpm --filter @honorer/example run start`

## Run

1. Build workspace: `pnpm -r run build`
2. Start example: `pnpm --filter @honorer/example run start`
3. Visit:
   - `http://localhost:3001/` → "Hello Hono!"
   - `http://localhost:3001/example` → `{ ok: true, message: 'Using @honorer/core' }`
