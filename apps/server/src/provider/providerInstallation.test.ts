import { assert, describe, it } from "@effect/vitest";
import { ProviderInstanceId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import { makeProviderInstallation } from "./providerInstallation.ts";

const instanceId = ProviderInstanceId.make("pi");

const makeRouter = () => makeProviderInstallation().pipe(Effect.scoped);

describe("provider installation (Pi-only build)", () => {
  it.effect("fails fast when starting a managed install", () =>
    Effect.gen(function* () {
      const router = yield* makeRouter();
      const error = yield* Effect.flip(router.start({ instanceId }));
      assert.equal(error._tag, "ProviderSetupError");
      assert.include(error.detail, "Pi-only build");
    }),
  );

  it.effect("fails fast when cancelling a managed install", () =>
    Effect.gen(function* () {
      const router = yield* makeRouter();
      const error = yield* Effect.flip(router.cancel({ instanceId, operationId: "operation" }));
      assert.equal(error._tag, "ProviderSetupError");
      assert.include(error.detail, "Pi-only build");
    }),
  );

  it.effect("fails fast when removing a managed install", () =>
    Effect.gen(function* () {
      const router = yield* makeRouter();
      const error = yield* Effect.flip(router.remove({ instanceId }));
      assert.equal(error._tag, "ProviderSetupError");
      assert.include(error.detail, "Pi-only build");
    }),
  );

  it.effect("fails fast when observing install progress", () =>
    Effect.gen(function* () {
      const router = yield* makeRouter();
      const error = yield* Effect.flip(Stream.runCollect(router.subscribe({ instanceId })));
      assert.equal(error._tag, "ProviderSetupError");
      assert.include(error.detail, "Pi-only build");
    }),
  );
});
