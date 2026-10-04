import * as NodePath from "node:path";

import { assert, describe, it } from "vite-plus/test";

import { evaluateDesktopSmokeOutput, makeDesktopSmokeEnvironment } from "./smoke-test-output.mjs";

describe("desktop smoke output", () => {
  it("isolates both application and Electron profile state", () => {
    const environment = makeDesktopSmokeEnvironment(
      { HOME: "/Users/alice", PICODE_HOME: "/Users/alice/.picode", PATH: "/usr/bin" },
      "/tmp/t3code-smoke",
    );

    const smokeHome = NodePath.join("/tmp/t3code-smoke", "home");
    assert.equal(environment.HOME, smokeHome);
    assert.equal(environment.XDG_CONFIG_HOME, NodePath.join(smokeHome, ".config"));
    assert.equal(environment.APPDATA, NodePath.join(smokeHome, "AppData", "Roaming"));
    assert.equal(environment.LOCALAPPDATA, NodePath.join(smokeHome, "AppData", "Local"));
    assert.equal(environment.PICODE_HOME, NodePath.join("/tmp/t3code-smoke", "picode"));
    assert.equal(environment.PATH, "/usr/bin");
  });

  it("requires a positive backend readiness signal", () => {
    assert.deepEqual(evaluateDesktopSmokeOutput("backend ready"), [
      "Desktop main-window readiness signal was not observed",
    ]);
    assert.deepEqual(evaluateDesktopSmokeOutput("main window ready"), []);
    assert.deepEqual(evaluateDesktopSmokeOutput("main window ready", { timedOut: true }), [
      "Desktop smoke test timed out",
    ]);
  });

  it("retains fatal diagnostics even after readiness", () => {
    assert.deepEqual(
      evaluateDesktopSmokeOutput("main window ready\nUncaught TypeError: renderer failed"),
      ["Uncaught TypeError"],
    );
  });
});
