/**
 * Registry boot validation for `ProviderInstanceRegistryLive` in the Pi-only
 * build.
 *
 * The retained slice covers the unavailable-instance downgrade path: an
 * instance whose driver is not registered in this build must materialize as a
 * shadow snapshot (`listUnavailable`) instead of failing boot. Every other
 * multi-driver/multi-instance slice exercised the removed drivers and was
 * deleted with them.
 */
import { describe, expect, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  EnvironmentId,
  PiSettings,
  ProviderDriverKind,
  type ProviderInstanceConfigMap,
  ProviderInstanceId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import * as BackgroundPolicy from "../../background/BackgroundPolicy.ts";
import * as ServerEnvironment from "../../environment/ServerEnvironment.ts";
import * as ServerConfig from "../../config.ts";
import * as ServerSettings from "../../serverSettings.ts";
import { PiDriver, type PiDriverEnv } from "../Drivers/PiDriver.ts";
import * as ModelManifest from "../ModelManifest.ts";
import * as ProviderEventLoggers from "./ProviderEventLoggers.ts";
import { makeProviderInstanceRegistry } from "./ProviderInstanceRegistryLive.ts";
import { ProviderOrchestrationAdapterInfrastructureLive } from "./ProviderOrchestrationAdapterInfrastructure.ts";

const TestHttpClientLive = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.succeed(HttpClientResponse.fromWeb(request, Response.json({ version: "0.0.0" }))),
  ),
);

const TEST_EPOCH = DateTime.makeUnsafe("1970-01-01T00:00:00.000Z");

const decodePiSettings = Schema.decodeSync(PiSettings);

const makePiConfig = (overrides: Partial<PiSettings>): PiSettings => ({
  ...decodePiSettings({}),
  ...overrides,
});

const BackgroundPolicyAlwaysRunLayer = Layer.mock(BackgroundPolicy.BackgroundPolicy)({
  reportClientActivity: () => Effect.void,
  removeRpcClient: () => Effect.void,
  reportHostPowerState: () => Effect.void,
  snapshot: Effect.succeed({
    hostPower: {
      source: "unknown",
      idle: "unknown",
      idleSeconds: null,
      locked: "unknown",
      suspended: false,
      onBattery: "unknown",
      lowPowerMode: "unknown",
      thermalState: "unknown",
      stale: true,
      updatedAt: TEST_EPOCH,
    },
    leases: [],
    activeForegroundLeaseCount: 0,
    activeScopeKeys: [],
    shouldRunOpportunisticWork: true,
    updatedAt: TEST_EPOCH,
  }),
  streamChanges: Stream.empty,
  hasDemand: () => Effect.succeed(true),
  shouldRunScopeWork: () => Effect.succeed(true),
  shouldRunOpportunisticWork: Effect.succeed(true),
});

// `ServerConfig.layerTest` needs `FileSystem` to materialize its scratch
// directory. `Layer.merge` just unions requirements, so we push
// `NodeServices.layer` through `Layer.provideMerge` to satisfy that
// dependency while still surfacing NodeServices to the test body (the
// Pi driver's `create` yields `ChildProcessSpawner` directly).
const baseLayer = ServerConfig.layerTest(process.cwd(), {
  prefix: "provider-instance-registry-test",
}).pipe(
  Layer.provideMerge(NodeServices.layer),
  Layer.provideMerge(Layer.mock(ServerSecretStore.ServerSecretStore)({})),
  Layer.provideMerge(
    Layer.succeed(ServerEnvironment.ServerEnvironmentIdentity, {
      getEnvironmentId: Effect.succeed(
        EnvironmentId.make("00000000-0000-4000-8000-000000000001"),
      ),
    }),
  ),
  Layer.provideMerge(BackgroundPolicyAlwaysRunLayer),
  Layer.provideMerge(ServerSettings.layerTest()),
  Layer.provideMerge(TestHttpClientLive),
  Layer.provideMerge(
    Layer.succeed(
      ProviderEventLoggers.ProviderEventLoggers,
      ProviderEventLoggers.NoOpProviderEventLoggers,
    ),
  ),
  Layer.provideMerge(ModelManifest.layerTest),
);
const testLayer = ProviderOrchestrationAdapterInfrastructureLive.pipe(
  Layer.provideMerge(baseLayer),
);

describe("ProviderInstanceRegistryLive — Pi-only registry boot", () => {
  it.live(
    "shadows instances whose driver is not registered in this build without failing boot",
    () =>
      Effect.gen(function* () {
        const piId = ProviderInstanceId.make("pi_main");
        const ghostId = ProviderInstanceId.make("ghost_main");

        const configMap: ProviderInstanceConfigMap = {
          [piId]: {
            driver: ProviderDriverKind.make("pi"),
            enabled: false,
            config: makePiConfig({}),
          },
          [ghostId]: {
            driver: ProviderDriverKind.make("ghostDriver"),
            displayName: "A fork-only driver we don't ship",
            enabled: false,
            config: { arbitrary: "payload", preserved: true },
          },
        };

        const { registry } = yield* makeProviderInstanceRegistry<PiDriverEnv>({
          drivers: [PiDriver],
          configMap,
        });

        const instances = yield* registry.listInstances;
        expect(instances).toHaveLength(1);
        expect(instances[0]!.instanceId).toBe(piId);
        expect(instances[0]!.driverKind).toBe(ProviderDriverKind.make("pi"));

        const unavailable = yield* registry.listUnavailable;
        expect(unavailable).toHaveLength(1);
        const ghost = unavailable[0]!;
        expect(ghost.instanceId).toBe(ghostId);
        expect(ghost.driver).toBe("ghostDriver");
        expect(ghost.availability).toBe("unavailable");
        expect(ghost.unavailableReason).toMatch(/ghostDriver/);
      }).pipe(Effect.provide(testLayer)),
  );
});
