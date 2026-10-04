import {
  type ProviderInstallCancelInput,
  type ProviderInstanceId,
  ProviderSetupError,
  type ProviderSetupInput,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

/**
 * Provider setup for the Pi-only build.
 *
 * The managed installers (Codex, Antigravity) were removed with their drivers:
 * the `pi` runtime is installed independently and only has to be discovered on
 * PATH. The wire contract keeps the `providerInstall*` RPC methods, so the
 * service shape survives and every operation fails fast with a typed setup
 * error instead of crashing.
 *
 * @module provider/providerInstallation
 */

/** Route instance setup to the environment-owned installer without owning the download. */
export const makeProviderInstallation = Effect.fn("makeProviderInstallation")(function* () {
  const fail = (instanceId: ProviderInstanceId, operation: string) =>
    new ProviderSetupError({
      instanceId,
      operation,
      detail: "Managed provider installation is not available in this Pi-only build.",
    });

  const start = Effect.fn("ProviderInstallation.start")(function* (input: ProviderSetupInput) {
    return yield* fail(input.instanceId, "install");
  });

  const cancel = Effect.fn("ProviderInstallation.cancel")(function* (
    input: ProviderInstallCancelInput,
  ) {
    return yield* fail(input.instanceId, "cancel-install");
  });

  const subscribe = (input: ProviderSetupInput) =>
    Stream.fromEffect(Effect.fail(fail(input.instanceId, "observe-install")));

  const remove = Effect.fn("ProviderInstallation.remove")(function* (input: ProviderSetupInput) {
    return yield* fail(input.instanceId, "remove-install");
  });

  return { start, cancel, subscribe, remove };
});
