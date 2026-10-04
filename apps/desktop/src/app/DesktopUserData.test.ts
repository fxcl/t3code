import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";

import { resolveUserDataPath } from "./DesktopUserData.ts";

it.effect("identifies a failed profile inspect and preserves its cause", () => {
  const profileState = "/profiles/picode/Local State";
  const cause = PlatformError.systemError({
    _tag: "PermissionDenied",
    module: "FileSystem",
    method: "exists",
    pathOrDescriptor: profileState,
  });
  return Effect.gen(function* () {
    const error = yield* resolveUserDataPath({
      appDataDirectory: "/profiles",
      isDevelopment: false,
      platform: "win32",
    }).pipe(Effect.flip);
    assert.equal(error.operation, "inspect");
    assert.equal(error.resourcePath, profileState);
    assert.equal(error.category, "PermissionDenied");
    assert.strictEqual(error.cause, cause);
  }).pipe(
    Effect.provideService(
      FileSystem.FileSystem,
      FileSystem.makeNoop({
        exists: () => Effect.fail(cause),
      }),
    ),
    Effect.provide(NodeServices.layer),
  );
});

it.effect("keeps the existing Windows profile and its browser databases", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "picode-profile-" });
    const profile = path.join(directory, "picode");
    const state = '{"os_crypt":{"encrypted_key":"test-encrypted-key"}}';
    yield* fs.makeDirectory(path.join(profile, "IndexedDB"), { recursive: true });
    yield* fs.writeFileString(path.join(profile, "Local State"), state);
    yield* fs.writeFileString(
      path.join(profile, "IndexedDB", "LOCK"),
      "Chromium owns this database",
    );
    assert.equal(
      yield* resolveUserDataPath({
        appDataDirectory: directory,
        isDevelopment: false,
        platform: "win32",
      }),
      profile,
    );
    assert.equal(yield* fs.readFileString(path.join(profile, "Local State")), state);
    assert.isTrue(yield* fs.exists(path.join(profile, "IndexedDB", "LOCK")));
    yield* fs.writeFileString(path.join(profile, "Local State"), "existing piCode state");
    assert.equal(
      yield* resolveUserDataPath({
        appDataDirectory: directory,
        isDevelopment: false,
        platform: "win32",
      }),
      profile,
    );
    assert.equal(
      yield* fs.readFileString(path.join(profile, "Local State")),
      "existing piCode state",
    );
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);
