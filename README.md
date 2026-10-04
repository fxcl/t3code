# piCode

piCode is an installable desktop GUI for the [Pi coding agent](https://pi.dev). It keeps the UI and event-sourced architecture of [T3 Code](https://github.com/pingdotgg/t3code), while using Pi as its only agent provider.

Pi supplies the model catalog, provider credentials, sessions, extensions, skills, prompt templates, and compaction. piCode talks to Pi through its RPC protocol instead of adding adapters for other coding harnesses.

## Requirements

- Node.js 24
- [Vite+](https://viteplus.dev)
- [Pi](https://pi.dev/docs/latest/sdk), installed on the server machine's `PATH` and authenticated with at least one model provider
- Rust, for the desktop resource monitor

```bash
npm install -g @earendil-works/pi-coding-agent
curl -fsSL https://vite.plus | bash
```

## Development

```bash
vp i
vp run dev:desktop
```

Development state is isolated under `~/.t3/dev`. Linked git worktrees use their own ignored `.t3` directory. Set `T3CODE_HOME` or pass `--base-dir` when an explicit isolated location is needed.

## Build the desktop app

```bash
vp run build:resource-monitor
vp run dist:desktop:dmg:arm64
```

The macOS installer is written to `release/piCode-<version>-arm64.dmg`.

The packaged app includes Electron, the web renderer, and the local server. It stores production state under `~/.t3/userdata`; no state migration is required.

## Verification

```bash
vp run --filter @t3tools/desktop test
vp run --filter @t3tools/desktop typecheck
vp run --filter t3 typecheck
vp run --filter @t3tools/web typecheck
```

Use a temporary `T3CODE_HOME` for smoke tests and packaged launches. Never point piCode development or tests at the live install's `~/.t3/userdata`.

## Pi integration

See [docs/user/providers-pi.md](./docs/user/providers-pi.md) for the RPC adapter, supported commands, model discovery, event mapping, and the Pi-native surface (extension dialogs, tree navigation, rollback, scoped models, trust, auth flow, and share/export).

## Attribution

piCode is derived from [T3 Code](https://github.com/pingdotgg/t3code), licensed under MIT. See [LICENSE](./LICENSE).
