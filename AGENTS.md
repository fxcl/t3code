# piCode (T3 Code port)

This repository is the T3 Code codebase converged onto piCode's end state: a desktop GUI for the Pi coding agent. It keeps the T3 Code desktop/web UX and event-sourced server architecture, but Pi is the only agent provider. The non-Pi provider adapters, the mobile and marketing apps, and the ACP interop layer were removed deliberately — do not restore them.

## Product boundaries

- **Desktop is the product.** `apps/desktop` packages Electron, the web renderer, and the local server into an installable app (desktop `productName`: `piCode`).
- **Web is the renderer.** `apps/web` is bundled into desktop and can also run locally for development.
- **Pi is the provider.** Provider behavior goes through `apps/server/src/provider/piRuntime.ts`, the Pi driver, and the Pi adapter. Do not add Codex, Claude, Cursor, Grok, OpenCode, Antigravity, or ACP adapters. Persisted instances of removed drivers must keep surfacing as "unavailable" snapshots, never parse failures.
- **No mobile or marketing surfaces.** Do not recreate removed apps or compatibility code for them.
- **Contracts stay typed.** Wire schemas live in `packages/contracts` (including the `piNative.*` family in `src/piNative.ts`); shared client behavior lives in `packages/client-runtime`.

## Identity and state

- Product name: `piCode`
- Data home: `~/.t3` (override with `T3CODE_HOME` or `--base-dir`); runtime state under its `userdata` directory
- Development state: `~/.t3/dev`, or the linked worktree's own gitignored `.t3` directory

Never read or write the live install's `~/.t3/userdata` — it is the developer's real, in-use database. Tests and smoke runs must use a temporary home (`T3CODE_HOME` or `--home-dir`).

## Architecture

Clients send typed WebSocket requests. The server turns them into commands, a decider produces persisted events, projectors derive the read model, reactors run side effects and emit receipts, and each turn ends with a git checkpoint. Keep provider-specific complexity at the Pi adapter boundary.

Key locations:

- `apps/desktop` — Electron shell, bundled backend, packaging
- `apps/web` — React/Vite renderer
- `apps/server` — WebSocket server, orchestration, Pi adapter, checkpointing
- `packages/contracts` — wire schemas
- `packages/shared` — shared runtime utilities
- `packages/client-runtime` — shared client state and RPC behavior
- `packages/ssh`, `packages/tailscale` — remote-access helpers
- `infra/relay` — T3 Connect relay (Cloudflare Workers, deployed via Alchemy)
- `docs/` — user, internals, and operations documentation

## Safety

- Never kill by process-name or path pattern. Stop only a PID captured at spawn.
- Never point development or tests at the live `~/.t3/userdata`.
- Do not set `VITE_HTTP_URL` or `VITE_WS_URL` for development; Vite proxies local traffic.
- Do not edit `.repos/` vendored references.

## Development

- Install: `vp i`
- Desktop dev: `vp run dev:desktop`
- Build desktop: `vp run build:desktop` (artifact written to `release/`)
- Focused tests: `vp test run <files>`
- Targeted typecheck: `vp run --filter <package> typecheck`

Use the smallest relevant verification. Do not run repository-wide checks unless the user asks. Desktop smoke tests and packaged launches must use a temporary `T3CODE_HOME`.

## Code style

- Shortest correct diff; no speculative abstractions or compatibility layers.
- Match surrounding style. No `any`, narrating comments, defensive theater, or swallowed errors.
- Keep orchestration pure, UI dumb, and effects visible.
- User-visible behavior needs a focused behavioral test.
- Preserve external `*.t3.codes` domains and internal `@t3tools/*` package names unless a separate migration explicitly changes them.

## Commits

- Conventional commit titles, plain language: `fix(web): new threads no longer spike CPU`.
- Never make a PR unless the developer explicitly asks.
