import { describe, expect, it } from "vite-plus/test";

import {
  NATIVE_SLASH_COMMANDS,
  PI_MANAGEMENT_COMMANDS,
  isNativeSlashCommand,
  isPiManagementCommand,
  parseNativeSlashCommand,
  resolveNativeSlashCommandDispatch,
} from "./nativeSlashCommands";

describe("native slash commands", () => {
  it("includes every Pi 0.83 built-in command exactly once", () => {
    const names = NATIVE_SLASH_COMMANDS.map(({ command }) => command);
    const commandNames = new Set<string>(names);
    const piBuiltIns = [
      "settings",
      "model",
      "scoped-models",
      "export",
      "import",
      "share",
      "copy",
      "name",
      "session",
      "changelog",
      "hotkeys",
      "fork",
      "clone",
      "tree",
      "trust",
      "login",
      "logout",
      "new",
      "compact",
      "resume",
      "reload",
      "quit",
    ];

    expect(commandNames.size).toBe(names.length);
    expect(piBuiltIns.filter((command) => !commandNames.has(command))).toEqual([]);
  });

  it("maps every Phase 3 piNative RPC capability to exactly one command", () => {
    // The commands that reach a piNative RPC (dialog-routed); the remaining
    // entries (model/plan/default/new/quit/hotkeys) are handled locally.
    const rpcBackedCommands = [
      "tree",
      "copy",
      "compact",
      "reload",
      "name",
      "session",
      "stats",
      "export",
      "settings",
      "scoped-models",
      "resume",
      "import",
      "fork",
      "clone",
      "trust",
      "changelog",
      "login",
      "logout",
      "share",
    ] as const;
    const commandNames = new Set(NATIVE_SLASH_COMMANDS.map(({ command }) => command));

    for (const command of rpcBackedCommands) {
      expect(commandNames.has(command)).toBe(true);
    }
  });

  it("intercepts manually typed native commands with surrounding whitespace or arguments", () => {
    expect(parseNativeSlashCommand(" /TREE ")).toBe("tree");
    expect(parseNativeSlashCommand("/tree instructions")).toBe("tree");
    expect(parseNativeSlashCommand("/model openai/gpt-5")).toBe("model");
    expect(parseNativeSlashCommand("/plan please")).toBe("plan");
    expect(parseNativeSlashCommand("/default now")).toBe("default");
    expect(parseNativeSlashCommand("/share")).toBe("share");
  });

  it("leaves extension commands and malformed native names as provider text", () => {
    expect(parseNativeSlashCommand("/extension-command arguments")).toBeNull();
    expect(parseNativeSlashCommand("/ tree")).toBeNull();
    expect(parseNativeSlashCommand("/treehouse")).toBeNull();
  });

  it("gives native names collision precedence", () => {
    expect(isNativeSlashCommand("tree")).toBe(true);
    expect(isNativeSlashCommand("extension-command")).toBe(false);
  });

  it("classifies management commands without session or local-only entries", () => {
    // Session-scoped commands (4.7 dialog) and purely local actions are not
    // "management"; only the Pi management surface (4.8 dialog) qualifies.
    const notManagement = new Set([
      "model",
      "plan",
      "default",
      "new",
      "tree",
      "copy",
      "compact",
      "reload",
      "name",
      "session",
      "stats",
      "export",
      "quit",
      "hotkeys",
    ]);
    for (const { command } of NATIVE_SLASH_COMMANDS) {
      expect(isPiManagementCommand(command)).toBe(!notManagement.has(command));
    }
    expect(PI_MANAGEMENT_COMMANDS.length).toBe(NATIVE_SLASH_COMMANDS.length - notManagement.size);
  });

  it("matches Pi's empty-session response for /tree on a local draft", () => {
    expect(resolveNativeSlashCommandDispatch("tree", true)).toEqual({
      type: "notice",
      message: "No entries in session",
    });
    expect(resolveNativeSlashCommandDispatch("tree", false)).toEqual({
      type: "dialog",
      command: "tree",
    });
    for (const { command } of NATIVE_SLASH_COMMANDS) {
      if (command !== "tree") {
        expect(resolveNativeSlashCommandDispatch(command, true)).toEqual({
          type: "dialog",
          command,
        });
      }
    }
  });
});
