import { describe, expect, it } from "vite-plus/test";
import { ProviderDriverKind } from "@t3tools/contracts";

import { DRIVER_OPTION_BY_VALUE } from "./providerDriverMeta";
import {
  deriveProviderSettingsFields,
  nextProviderConfigWithFieldValue,
} from "./ProviderSettingsForm";

describe("ProviderSettingsForm helpers", () => {
  it("derives visible Pi config fields from the client definition schema", () => {
    const pi = DRIVER_OPTION_BY_VALUE[ProviderDriverKind.make("pi")];

    expect(pi).toBeDefined();
    expect(deriveProviderSettingsFields(pi!).map((field) => field.key)).toEqual([
      "binaryPath",
      "launchArgs",
    ]);
  });

  it("sources Pi labels and descriptions from schema annotations", () => {
    const pi = DRIVER_OPTION_BY_VALUE[ProviderDriverKind.make("pi")];
    expect(pi).toBeDefined();

    expect(deriveProviderSettingsFields(pi!)[0]).toMatchObject({
      key: "binaryPath",
      label: "Binary path",
      description: "Path to the Pi coding agent binary.",
      control: "text",
    });
  });

  it("hides the fields that are not part of the provider settings form", () => {
    const pi = DRIVER_OPTION_BY_VALUE[ProviderDriverKind.make("pi")];
    expect(pi).toBeDefined();

    const visibleKeys = deriveProviderSettingsFields(pi!).map((field) => field.key);
    expect(visibleKeys).not.toContain("enabled");
    expect(visibleKeys).not.toContain("customModels");
  });

  it("preserves unknown config keys while omitting an empty Pi binary path", () => {
    const pi = DRIVER_OPTION_BY_VALUE[ProviderDriverKind.make("pi")];
    expect(pi).toBeDefined();

    const binaryPath = deriveProviderSettingsFields(pi!).find(
      (field) => field.key === "binaryPath",
    );
    expect(binaryPath).toBeDefined();

    const next = nextProviderConfigWithFieldValue(
      { forkOwned: 1, binaryPath: "/usr/local/bin/pi" },
      binaryPath!,
      "",
    );

    expect(next).toEqual({ forkOwned: 1 });
  });

  it("omits false boolean fields when clearWhenEmpty is omit", () => {
    const next = nextProviderConfigWithFieldValue(
      { forkOwned: 1, experimental: true },
      {
        key: "experimental",
        control: "switch",
        label: "Experimental",
        clearWhenEmpty: "omit",
        defaultBooleanValue: false,
      },
      false,
    );

    expect(next).toEqual({ forkOwned: 1 });
  });

  it("omits true boolean fields when true is the default", () => {
    const next = nextProviderConfigWithFieldValue(
      { forkOwned: 1, experimental: false },
      {
        key: "experimental",
        control: "switch",
        label: "Experimental",
        clearWhenEmpty: "omit",
        defaultBooleanValue: true,
      },
      true,
    );

    expect(next).toEqual({ forkOwned: 1 });
  });

  it("stores false boolean fields when true is the default", () => {
    const next = nextProviderConfigWithFieldValue(
      undefined,
      {
        key: "experimental",
        control: "switch",
        label: "Experimental",
        clearWhenEmpty: "omit",
        defaultBooleanValue: true,
      },
      false,
    );

    expect(next).toEqual({ experimental: false });
  });

  it("preserves false boolean fields when clearWhenEmpty is persist", () => {
    const next = nextProviderConfigWithFieldValue(
      undefined,
      {
        key: "experimental",
        control: "switch",
        label: "Experimental",
        clearWhenEmpty: "persist",
      },
      false,
    );

    expect(next).toEqual({ experimental: false });
  });
});
