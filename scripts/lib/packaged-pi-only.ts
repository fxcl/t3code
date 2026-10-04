/**
 * Static guards proving the packaged desktop artifact ships Pi only.
 *
 * The removed providers (Anthropic, Cursor, OpenCode, ...) and the ACP bridge
 * packages must never re-enter a packaged artifact. This module lets the
 * packaging pipeline fail loudly when a removed provider package appears in:
 *
 * - the staged per-platform dependencies (the node_modules tree that becomes
 *   app.asar, or the Windows server.asar sidecar's node_modules),
 * - the server runtime-external selection (the sidecar's external closure), or
 * - the Windows server.asar header (every file the sidecar archives).
 */

import type { DirectoryRecord } from "@electron/asar";

/**
 * Name or scope prefixes that identify a removed provider (or ACP) package.
 * A name matches when it equals a marker or starts with one, so the bare
 * `@opencode` prefix covers the whole removed OpenCode package family.
 */
export const REMOVED_PROVIDER_PACKAGE_MARKERS = [
  "@anthropic-ai/",
  "@cursor/",
  "@opencode",
  "@t3tools/effect-acp",
  "@t3tools/effect-codex-app-server",
] as const;

export function isRemovedProviderPackageName(name: string): boolean {
  return REMOVED_PROVIDER_PACKAGE_MARKERS.some(
    (marker) => name === marker || name.startsWith(marker),
  );
}

/** Returns the sorted set of removed provider packages among `packageNames`. */
export function findRemovedProviderPackages(packageNames: Iterable<string>): string[] {
  const offenders = new Set<string>();
  for (const name of packageNames) {
    if (isRemovedProviderPackageName(name)) {
      offenders.add(name);
    }
  }
  return [...offenders].sort();
}

/**
 * Extracts the package names a node_modules entry path belongs to. Scoped
 * packages span two segments, and nested installs restart at every
 * `node_modules` boundary, so `node_modules/@a/b/node_modules/c/x.js` yields
 * `["@a/b", "c"]`.
 */
export function packageNamesFromNodeModulesPath(entryPath: string): string[] {
  const names: string[] = [];
  const segments = entryPath.split("/");
  for (let index = 0; index < segments.length; index++) {
    if (segments[index] !== "node_modules") continue;
    const next = segments[index + 1];
    if (next === undefined || next.length === 0) continue;
    if (next.startsWith("@")) {
      const scopedName = segments[index + 2];
      if (scopedName === undefined || scopedName.length === 0) continue;
      names.push(`${next}/${scopedName}`);
      index += 2;
    } else {
      names.push(next);
      index += 1;
    }
  }
  return names;
}

/**
 * Walks an asar header and returns the sorted set of removed provider packages
 * archived anywhere under a `node_modules` directory.
 */
export function findRemovedProviderAsarEntries(header: DirectoryRecord): string[] {
  const offenders = new Set<string>();

  const visit = (directory: DirectoryRecord, parentPath: string): void => {
    for (const [name, entry] of Object.entries(directory.files)) {
      const entryPath = parentPath.length === 0 ? name : `${parentPath}/${name}`;
      if (entryPath.includes("node_modules/")) {
        for (const packageName of packageNamesFromNodeModulesPath(entryPath)) {
          if (isRemovedProviderPackageName(packageName)) {
            offenders.add(packageName);
          }
        }
      }
      if ("files" in entry) {
        visit(entry, entryPath);
      }
    }
  };

  visit(header, "");
  return [...offenders].sort();
}
