# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A web + desktop editor for authoring Luau scripts that run on a Minecraft server's Luau-based server-side scripting engine. Users join the server and then open the web or desktop editor to work on their project. The UI is loosely modelled after JetBrains Fleet "Islands" — a workspace with tool docks on the left/bottom/right and editor panels in the center that split/nest.

## Workspace topology

This is a Bun-managed monorepo (`bun.lock`, `workspaces` in root `package.json`) with four packages:

- `@hollowcube/common` — Platform-agnostic app code. **Most of the app should live here.** Pure TypeScript, no React/DOM deps in `package.json` today. Currently nearly empty (`Brand` type + version constant); expect to grow as logic is moved in from `web/src/workspace`.
- `@hollowcube/design-system` — UI primitives. base-ui (`@base-ui/react`) under the hood, originally scaffolded from shadcn (`components.json` is kept for `shadcn add`). Tailwind v4 via `@tailwindcss/vite`. Includes a CodeMirror 6 editor component (`./editor` subpath export) and a `./demo` subpath for the showcase pages.
- `@hollowcube/web` — Browser SPA shell. Vite + React 19, `@generouted/react-router` file-based routing under `src/pages/`.
- `@hollowcube/desktop` (at `desktop/frontend/`) — Wails 3 frontend shell. Same React/Vite/generouted stack but uses `createHashRouter` and the `@wailsio/runtime` Vite plugin pointed at `./bindings` (generated Go bindings). Sibling `desktop/main.go` is the Wails Go host.

**Platform rule:** `web/` and `desktop/frontend/` should contain only platform-specific glue (entry point, providers, routing root, Wails bridge wiring). All shared screens, stores, and abstractions belong in `common`. The current `web/src/workspace/` directory (workspace store + layout components) is the prime example of code that should migrate to `common` behind a platform-abstraction boundary.

## Workspace UI model (the core abstraction)

The "workspace" screen is a 3-column / 2-row layout:

- Columns: `left` ToolDock | `center` (editors) | `right` ToolDock — sized by `columnSizes: [l, m, r]`
- The middle column splits vertically: editors on top, `bottom` ToolDock below — sized by `middleSizes: [center, bottom]`
- Center is a recursive tree of `EditorGroup` split nodes (horizontal/vertical) with leaves holding tabs; tool docks are flat tab lists
- Tabs are polymorphic by `kind` (e.g. `'files'`, `'search'`, `'editor-json'`, `'editor-text'`) — add new tab types by extending the discriminated union in `types.ts`
- State lives in a Zustand store (`store.ts`) persisted to `localStorage` with `STORAGE_VERSION`; bump the version when the shape changes
- Drag-and-drop uses `@dnd-kit`; tabs can move between docks/leaves and drop on a leaf edge to split it
- Resizing uses `react-resizable-panels`

When changing the layout model, update `types.ts` and `store.ts` together and bump `STORAGE_VERSION`.

## Toolchain & commands

Run all commands from the repo root unless noted.

- `bun install` — install deps
- `bun run dev:web` — Vite dev server for the browser app
- `bun run dev:desktop` — `wails3 dev` (Vite on port 9245 + Go host); requires `wails3` CLI and Go installed
- `bun run build:web` / `bun run build:desktop`
- `bun run typecheck` — runs `tsc --noEmit` across every workspace via `bun --filter '*' typecheck`
- `bun run lint` / `bun run lint:fix` — oxlint
- `bun run format` / `bun run format:check` — oxfmt

**No test framework is configured.** Do not add `vitest`/`jest`/`bun test` invocations unless the user asks — there are no test files to run.

Workspace-scoped: `bun --filter @hollowcube/web <script>` (e.g. `typecheck`, `dev`, `build`).

Desktop-only Wails tasks live in `desktop/Taskfile.yml` (`task dev`, `task build`, `task build:server`, plus per-OS variants under `darwin:`/`windows:`/`linux:`).

## Conventions

- **Formatter is oxfmt, not Prettier.** Config in `.oxfmtrc.json`: 4-space indent, single quotes (incl. JSX), no semicolons, trailing commas everywhere, 100-col width, LF line endings. Imports are auto-sorted with a dedicated `@hollowcube/*` group between externals and relative imports — don't hand-organize imports.
- **Linter is oxlint.** TypeScript, React, react-hooks, jsx-a11y, unicorn, perf, etc. `@typescript-eslint/consistent-type-imports` is enforced — use `import type` for type-only imports. Underscore prefix (`_foo`) silences unused-var warnings.
- **TS is strict** with `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`. `verbatimModuleSyntax` means `import type` is mandatory for types — the formatter won't fix this for you.
- **Path alias `@/` → `src/`** is configured per-app in `web/vite.config.ts` and `desktop/frontend/vite.config.ts`. It is not available inside `common/` or `design-system/`.
- **UI primitives come from `@base-ui/react`**, not Radix. When extending design-system components, follow the existing CVA + `cn()` pattern (`design-system/src/utils.ts`). Icons are `lucide-react`. Fonts: JetBrains Mono via `@fontsource-variable/jetbrains-mono`.
- **Styling is Tailwind v4.** `design-system/src/globals.css` is the single source for tokens; web/desktop import it via `@hollowcube/design-system/globals.css`. Tailwind scans source via `@source` directives in that file rather than a `tailwind.config`.
- **Adding a shadcn component:** the design-system has `components.json` pointing at `@hollowcube/design-system/components`. Run `shadcn add` from `design-system/`. The output uses base-ui-style primitives, not Radix.
- **Generated files to leave alone:** `web/src/router.ts` and `desktop/frontend/src/router.ts` are overwritten by `@generouted/react-router`; `desktop/frontend/bindings/**` is generated by Wails and is gitignored/lint-ignored.

## Desktop ↔ Go bridge

- Go entry: `desktop/main.go` embeds `frontend/dist` as the asset filesystem and registers services (e.g. `GreetService` in `desktop/greetservice.go`).
- Generated TypeScript bindings land in `desktop/frontend/bindings/`. Frontend calls into Go via these bindings; events flow back via `@wailsio/runtime`.
- The desktop frontend uses **hash routing** because it loads from `file://` / Wails asset host — do not switch to browser history routing there.
