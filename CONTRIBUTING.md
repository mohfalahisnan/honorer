# We are currently not accepting external contributions as the project is under heavy development

Thank you for your interest in Honorer. We truly appreciate your enthusiasm and support. At this time, we are not accepting external contributions (pull requests) because the project is undergoing rapid iteration and foundational changes. This is a temporary status while we stabilize the architecture and developer experience.

---

## Development Status and Rationale

Honorer is in an active design and implementation phase. We are refining the module-first architecture, streamlining the public APIs, and improving the documentation and examples. During this stage:

- Core APIs and decorators may change without prior notice.
- Internal structure and repository layout can evolve between releases.
- CI/CD workflows and release strategies are being tuned.
- Documentation is being rewritten to match the current technical direction.

Accepting external PRs during this period would slow down iteration and create unnecessary churn for contributors. Once the APIs and architecture are stable, we will invite community contributions with clear expectations and a predictable review process.

---

## Project Vision

### Core Principles and Values
- Developer ergonomics and clarity over cleverness
- Strong type-safety with TypeScript and Zod
- Explicitness over hidden magic; predictable composition
- Modular design with clear boundaries and responsibilities
- Minimal runtime overhead and thoughtful dependencies
- Reliability through testing and incremental evolution
- Documentation-first mindset (actively being expanded)

### Long-term Objectives
- Stabilize the module system, decorators, and configuration API
- Deliver a consistent developer experience across Node and Edge runtimes
- Provide robust examples and end-to-end tests for common patterns
- Establish a plugin and integration ecosystem built on clear extension points
- Ship helpful tooling (e.g., scaffolding via `create-honorer-app`) to reduce setup friction
- Maintain semantic versioning and a clear release channel strategy (e.g., `beta` pre-releases)

### Technical Direction
- TypeScript (strict), ESM-only packages, targeting Node `>= 18.18`
- `pnpm` workspaces for dependency management and consistency
- `tsup` for builds, `vitest` for tests, and `biome` for lint/format
- Hono-centric routing and middleware model
- Zod for request/response validation; optional Kysely integration for data access
- Side-effect free modules and tree-shakeable outputs where feasible

---

## Future Contributor Guidelines (Once We Open Contributions)

When we are ready to accept contributions, we will follow this process:

- Start with an issue: Propose your idea or bug fix and align it with the project vision.
- For non-trivial features: Draft a short RFC (Markdown) outlining the problem, approach, and alternatives.
- Scope and alignment: Confirm that the change fits the modular architecture and established patterns.
- Implementation: Keep PRs focused and small. Large changes should be split into coherent steps.
- Documentation: Update README(s) and relevant docs to reflect behavior and usage.
- Tests: Include unit/integration tests using `vitest` for new features and bug fixes.
- Review: Expect constructive feedback focused on clarity, correctness, and maintainability.

---

## Style Requirements (To Be Followed When Contributions Open)

### Coding Standards
- Language: TypeScript with strict settings; ESM modules only.
- Structure: Keep modules explicit and side-effect free.
- Naming: PascalCase for classes/decorators, camelCase for variables/functions.
- Dependencies: Avoid heavy runtime dependencies in `@honorer/core`. Prefer small, well-maintained libraries when needed.

### Testing
- Use `vitest` for unit and integration tests.
- Cover core logic and edge cases; avoid superficial tests.
- Keep tests deterministic and fast; no network calls in unit tests.

### Formatting & Linting
- Use `biome` for lint and format: `pnpm run lint` and `pnpm run format`.
- Ensure CI passes locally before submitting PRs.

### Commit Messages (Conventional Commits)
Follow the Conventional Commits specification:
- `feat(core): add new module decorator`
- `fix(core): correct response formatting edge case`
- `docs(core): update README for new API`
- `chore(core): bump pnpm lockfile`
- `refactor(core): simplify controller registration`
- `test(core): add vitest coverage for validators`

Include a clear scope (e.g., `core`, `cli`, `docs`) and a concise description.

### Branching & PRs
- Branch naming: `feat/<area>-<short-description>`, `fix/<area>-<short-description>`
- Keep PRs small and focused; link the related issue.
- Provide a short summary, rationale, and before/after behavior in the PR description.

---

## Contact and Questions

For inquiries about future contribution opportunities or collaboration:
- Open a GitHub issue: https://github.com/mohfalahisnan/honorer/issues
- If your request is exploratory, please label the issue with `question` or `proposal`.

We will reevaluate the contribution policy as the project stabilizes and update this document accordingly.

---

## Important Notice

This repository is in early development. APIs, modules, and behavior may change quickly. Please avoid relying on undocumented or unstable interfaces. We’ll announce when the project is ready for broader community contributions.