// @effect-diagnostics nodeBuiltinImport:off - Tests assert against the real repository manifests.

import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

import { selectCliRuntimeExternalDependencies } from "./cli-external-packages.ts";
import { selectDesktopRuntimeExternalDependencies } from "./desktop-external-packages.ts";
import {
  findRemovedProviderAsarEntries,
  findRemovedProviderPackages,
  packageNamesFromNodeModulesPath,
} from "./packaged-pi-only.ts";

const REPOSITORY_ROOT = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../..",
);

type TestRecord = {
  files?: Record<string, TestRecord>;
  size?: number;
  unpacked?: boolean;
};

const fileRecord = (): TestRecord => ({ size: 1 });
const dirRecord = (files: Record<string, TestRecord>): TestRecord => ({ files });

function asHeader(record: TestRecord): Parameters<typeof findRemovedProviderAsarEntries>[0] {
  return record as Parameters<typeof findRemovedProviderAsarEntries>[0];
}

async function readJsonManifest(relativePath: string): Promise<Record<string, unknown>> {
  return JSON.parse(
    await NodeFSP.readFile(NodePath.join(REPOSITORY_ROOT, relativePath), "utf8"),
  ) as Record<string, unknown>;
}

async function readSource(relativePath: string): Promise<string> {
  return NodeFSP.readFile(NodePath.join(REPOSITORY_ROOT, relativePath), "utf8");
}

/**
 * Every relative import from `sourcePath` that reaches `directory` (for example
 * `./Drivers/...`) must resolve to `expectedFile`. Sibling type imports beside
 * the driver directory are allowed.
 */
function expectSingleDirectoryImport(
  source: string,
  sourcePath: string,
  directory: string,
  expectedFile: string,
): void {
  const imports = [...source.matchAll(new RegExp(`from "\\./${directory}/([^"]+)"`, "g"))].map(
    (match) => match[1],
  );
  expect(imports, `${sourcePath} ${directory} imports`).toEqual([expectedFile]);
}

describe("packaged-pi-only", () => {
  it("flags removed provider and ACP packages", () => {
    expect(
      findRemovedProviderPackages([
        "yaml",
        "@opencode/client",
        "@anthropic-ai/claude-agent-sdk",
        "node-pty",
        "@cursor/sdk",
        "@opencode-ai/sdk",
        "@t3tools/effect-codex-app-server",
        "@t3tools/effect-acp",
        "effect",
      ]),
    ).toEqual([
      "@anthropic-ai/claude-agent-sdk",
      "@cursor/sdk",
      "@opencode-ai/sdk",
      "@opencode/client",
      "@t3tools/effect-acp",
      "@t3tools/effect-codex-app-server",
    ]);
  });

  it("passes a Pi-only dependency set", () => {
    expect(
      findRemovedProviderPackages([
        "@effect/platform-node",
        "@ff-labs/fff-node",
        "@napi-rs/keyring",
        "diff",
        "effect",
        "jose",
        "node-pty",
        "proper-lockfile",
        "stream-chain",
        "stream-json",
        "yaml",
        "yauzl",
      ]),
    ).toEqual([]);
  });

  it("extracts package names from node_modules paths", () => {
    expect(packageNamesFromNodeModulesPath("node_modules/node-pty/build/Release/pty.node")).toEqual(
      ["node-pty"],
    );
    expect(packageNamesFromNodeModulesPath("node_modules/@cursor/sdk/dist/index.js")).toEqual([
      "@cursor/sdk",
    ]);
    expect(packageNamesFromNodeModulesPath("node_modules/@a/b/node_modules/c/index.js")).toEqual([
      "@a/b",
      "c",
    ]);
    expect(packageNamesFromNodeModulesPath("apps/server/dist/bin.mjs")).toEqual([]);
    expect(packageNamesFromNodeModulesPath("node_modules/@lonely")).toEqual([]);
  });

  it("finds removed provider packages in an asar header", () => {
    const header = dirRecord({
      apps: dirRecord({
        server: dirRecord({
          dist: dirRecord({ "bin.mjs": fileRecord() }),
        }),
      }),
      node_modules: dirRecord({
        effect: dirRecord({ "index.js": fileRecord() }),
        "@cursor": dirRecord({
          sdk: dirRecord({
            "package.json": fileRecord(),
            dist: dirRecord({ "main.js": fileRecord() }),
          }),
        }),
      }),
    });

    expect(findRemovedProviderAsarEntries(asHeader(header))).toEqual(["@cursor/sdk"]);
  });

  it("passes a Pi-only asar header, including nested installs", () => {
    const cleanHeader = dirRecord({
      node_modules: dirRecord({
        "node-pty": dirRecord({
          build: dirRecord({ Release: dirRecord({ "pty.node": fileRecord() }) }),
        }),
      }),
    });
    expect(findRemovedProviderAsarEntries(asHeader(cleanHeader))).toEqual([]);

    const nestedHeader = dirRecord({
      node_modules: dirRecord({
        "@scope": dirRecord({
          pkg: dirRecord({
            node_modules: dirRecord({
              "@opencode": dirRecord({
                client: dirRecord({ "index.js": fileRecord() }),
              }),
            }),
          }),
        }),
      }),
    });
    expect(findRemovedProviderAsarEntries(asHeader(nestedHeader))).toEqual(["@opencode/client"]);
  });

  it("finds no removed provider packages in the real app manifests or their selections", async () => {
    const serverManifest = await readJsonManifest("apps/server/package.json");
    const serverDependencies = serverManifest.dependencies as Record<string, string>;
    expect(findRemovedProviderPackages(Object.keys(serverDependencies))).toEqual([]);
    expect(
      findRemovedProviderPackages(
        Object.keys(selectCliRuntimeExternalDependencies(serverDependencies)),
      ),
    ).toEqual([]);

    const desktopManifest = await readJsonManifest("apps/desktop/package.json");
    const desktopDependencies = desktopManifest.dependencies as Record<string, string>;
    expect(findRemovedProviderPackages(Object.keys(desktopDependencies))).toEqual([]);
    expect(
      findRemovedProviderPackages(
        Object.keys(selectDesktopRuntimeExternalDependencies(desktopDependencies)),
      ),
    ).toEqual([]);
  });

  it("registers Pi as the only built-in provider driver", async () => {
    const source = await readSource("apps/server/src/provider/builtInDrivers.ts");
    expect(source).toMatch(/=\s*\[PiDriver\]/);
    expectSingleDirectoryImport(
      source,
      "apps/server/src/provider/builtInDrivers.ts",
      "Drivers",
      "PiDriver.ts",
    );
  });

  it("registers Pi as the only orchestration adapter driver", async () => {
    const source = await readSource(
      "apps/server/src/orchestration-v2/builtInProviderAdapterDrivers.ts",
    );
    expect(source).toMatch(/=\s*\[PiAdapterV2Driver\]/);
    expectSingleDirectoryImport(
      source,
      "apps/server/src/orchestration-v2/builtInProviderAdapterDrivers.ts",
      "Adapters",
      "PiAdapterV2.ts",
    );
  });
});
