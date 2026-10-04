/**
 * BUILT_IN_DRIVERS — the static set of `ProviderDriver`s this build ships
 * with.
 *
 * This fork ships exactly one driver: `pi`. Every other first-party driver
 * (codex, claude, cursor, grok, opencode, antigravity, acpRegistry) was
 * removed with the Pi-only port; persisted settings that still name a removed
 * driver kind surface as an `"unavailable"` shadow snapshot at runtime (see
 * `buildUnavailableProviderSnapshot`) instead of failing the boot.
 *
 * The registry iterates this array when resolving `providerInstances`
 * entries. The aggregated `BuiltInDriversEnv` type is the union of the
 * shipped drivers' env requirements — the registry layer's `R` is this type,
 * and the runtime layer (ChildProcessSpawner, FileSystem, Path, ServerConfig,
 * …) must satisfy it.
 *
 * @module provider/builtInDrivers
 */
import { PiDriver, type PiDriverEnv } from "./Drivers/PiDriver.ts";
import type { AnyProviderDriver } from "./ProviderDriver.ts";

/**
 * Union of infrastructure services required to construct any built-in
 * driver. The registry layer declares `R = BuiltInDriversEnv`; the runtime
 * layer must provide every service in this union.
 */
export type BuiltInDriversEnv = PiDriverEnv;

/**
 * Ordered list of built-in drivers. Order matters only for tie-breaking in
 * UI presentation — the registry itself is keyed by `driverKind`, so
 * iteration order has no functional effect on instance lookup.
 */
export const BUILT_IN_DRIVERS: ReadonlyArray<AnyProviderDriver<BuiltInDriversEnv>> = [PiDriver];
