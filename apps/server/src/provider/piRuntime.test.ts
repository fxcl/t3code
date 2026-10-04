import { describe, expect, it } from "vite-plus/test";

import type { PiSettings } from "@t3tools/contracts";

import { PI_RPC_CAPABILITIES, piRpcCapabilityIssue, resolvePiRuntimeCommand } from "./piRuntime.ts";

const settings = (binaryPath: string): PiSettings => ({
  enabled: true,
  binaryPath,
  launchArgs: "",
  customModels: [],
});

describe("piRuntime", () => {
  // t3code ships no bundled pi package, so the default binary setting resolves
  // to a `pi` executable on PATH invoked with `--mode rpc`.
  it("runs the default binary setting through the RPC mode flag", () => {
    const runtime = resolvePiRuntimeCommand({
      piSettings: settings("pi"),
      entry: "rpc",
      environment: { HOME: "/tmp/home" },
      executablePath: "/app/d4",
      isElectron: false,
    });

    expect(runtime.binaryPath).toBe("/app/d4");
    expect(runtime.argsPrefix).toEqual(["--mode", "rpc"]);
    expect(runtime.environment).toEqual({ HOME: "/tmp/home" });
  });

  it("adds no mode flag for the CLI entry", () => {
    const runtime = resolvePiRuntimeCommand({
      piSettings: settings("pi"),
      entry: "cli",
      executablePath: "/usr/bin/node",
      isElectron: false,
    });

    expect(runtime.binaryPath).toBe("/usr/bin/node");
    expect(runtime.argsPrefix).toEqual([]);
  });

  it("runs through Electron's Node mode", () => {
    const runtime = resolvePiRuntimeCommand({
      piSettings: settings(""),
      entry: "rpc",
      environment: { HOME: "/tmp/home" },
      executablePath: "/app/d4",
      isElectron: true,
    });

    expect(runtime.environment).toEqual({ HOME: "/tmp/home", ELECTRON_RUN_AS_NODE: "1" });
  });

  it("preserves an explicit external binary override", () => {
    const environment = { PATH: "/custom/bin" };
    const runtime = resolvePiRuntimeCommand({
      piSettings: settings(" /custom/pi "),
      entry: "rpc",
      environment,
    });

    expect(runtime).toEqual({
      binaryPath: "/custom/pi",
      argsPrefix: ["--mode", "rpc"],
      environment,
    });
  });

  it("validates the native-control protocol", () => {
    expect(
      piRpcCapabilityIssue({
        data: { protocolVersion: 1, capabilities: [...PI_RPC_CAPABILITIES] },
      }),
    ).toBeUndefined();
    expect(
      piRpcCapabilityIssue({ data: { protocolVersion: 1, capabilities: ["navigate_tree"] } }),
    ).toBe(
      "missing capabilities: abort_branch_summary, reload, set_entry_label, safe_settings, scoped_models, session_management, project_trust, changelog, auth",
    );
    expect(piRpcCapabilityIssue({ data: { protocolVersion: 2, capabilities: [] } })).toBe(
      "expected protocol version 1",
    );
  });
});
