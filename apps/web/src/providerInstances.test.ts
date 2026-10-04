import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  applyProviderInstanceSettings,
  deriveProviderEntriesByEnvironment,
  deriveProviderInstanceEntries,
  getDefaultProviderInstanceModel,
  isProviderInstancePickerReady,
  isProviderInstancePickerVisible,
  resolveDefaultProviderModelSelection,
  resolveProviderCatalogAvailability,
  resolveSelectableProviderInstance,
} from "./providerInstances";

function provider(input: {
  provider?: ProviderDriverKind;
  instanceId: string;
  enabled?: boolean;
  availability?: ServerProvider["availability"];
  displayName?: string;
  accentColor?: string;
  status?: ServerProvider["status"];
  models?: ServerProvider["models"];
  supportsTextGeneration?: boolean;
}): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make(input.instanceId),
    driver: input.provider ?? ProviderDriverKind.make("pi"),
    ...(input.supportsTextGeneration === undefined
      ? {}
      : { supportsTextGeneration: input.supportsTextGeneration }),
    ...(input.displayName ? { displayName: input.displayName } : {}),
    ...(input.accentColor ? { accentColor: input.accentColor } : {}),
    enabled: input.enabled ?? true,
    installed: true,
    version: null,
    status: input.status ?? "ready",
    ...(input.availability ? { availability: input.availability } : {}),
    auth: { status: "authenticated" },
    checkedAt: "2026-01-01T00:00:00.000Z",
    models: input.models ?? [],
    slashCommands: [],
    skills: [],
  };
}

const model = (slug: string, isCustom = false, isDefault = false) => ({
  slug,
  name: slug,
  isCustom,
  ...(isDefault ? { isDefault: true } : {}),
  capabilities: {},
});

describe("isProviderInstancePickerReady", () => {
  it("rejects a disabled instance even while its last probe status is ready", () => {
    const [entry] = deriveProviderInstanceEntries([
      provider({ instanceId: "pi", enabled: false }),
    ]);

    expect(entry?.status).toBe("ready");
    expect(entry && isProviderInstancePickerReady(entry)).toBe(false);
  });

  it("accepts an enabled, available, ready instance", () => {
    const [entry] = deriveProviderInstanceEntries([provider({ instanceId: "pi" })]);

    expect(entry && isProviderInstancePickerReady(entry)).toBe(true);
  });
});

describe("resolveProviderCatalogAvailability", () => {
  const [entry] = deriveProviderInstanceEntries([provider({ instanceId: "pi" })]);

  it("keeps the initial reactive config state distinct from an empty catalogue", () => {
    expect(
      resolveProviderCatalogAvailability({
        catalogLoaded: false,
        entries: [],
        selectedEntry: undefined,
      }),
    ).toBe("loading");
    expect(
      resolveProviderCatalogAvailability({
        catalogLoaded: true,
        entries: [],
        selectedEntry: undefined,
      }),
    ).toBe("unconfigured");
  });

  it("distinguishes a selected provider from configured but unusable providers", () => {
    expect(
      resolveProviderCatalogAvailability({
        catalogLoaded: true,
        entries: entry ? [entry] : [],
        selectedEntry: entry,
      }),
    ).toBe("ready");
    expect(
      resolveProviderCatalogAvailability({
        catalogLoaded: true,
        entries: entry ? [entry] : [],
        selectedEntry: undefined,
      }),
    ).toBe("unavailable");
  });
});

describe("isProviderInstancePickerVisible", () => {
  it("keeps enabled instances in the rail and removes disabled instances", () => {
    const [enabledEntry, disabledEntry] = deriveProviderInstanceEntries([
      provider({ instanceId: "pi" }),
      provider({ instanceId: "pi_work", enabled: false }),
    ]);

    expect(enabledEntry && isProviderInstancePickerVisible(enabledEntry)).toBe(true);
    expect(disabledEntry && isProviderInstancePickerVisible(disabledEntry)).toBe(false);
  });
});

describe("applyProviderInstanceSettings", () => {
  it("uses settings when a streamed snapshot still reports a disabled default as enabled", () => {
    const entries = deriveProviderInstanceEntries([provider({ instanceId: "pi" })]);
    const [entry] = applyProviderInstanceSettings(entries, {
      providerInstances: {
        [ProviderInstanceId.make("pi")]: {
          driver: ProviderDriverKind.make("pi"),
          enabled: false,
        },
      },
      providers: {} as never,
    });

    expect(entry?.enabled).toBe(false);
  });

  it("treats a removed custom instance snapshot as disabled", () => {
    const entries = deriveProviderInstanceEntries([
      provider({ instanceId: "pi_work" }),
    ]);
    const [entry] = applyProviderInstanceSettings(entries, {
      providerInstances: {},
      providers: {} as never,
    });

    expect(entry?.enabled).toBe(false);
  });

  it.each(["constructor", "toString"])(
    "treats a removed custom instance named %s as disabled",
    (instanceId) => {
      const entries = deriveProviderInstanceEntries([provider({ instanceId })]);
      const [entry] = applyProviderInstanceSettings(entries, {
        providerInstances: {},
        providers: {} as never,
      });

      expect(entry?.enabled).toBe(false);
    },
  );

  it("uses settings for a configured custom instance named constructor", () => {
    const instanceId = ProviderInstanceId.make("constructor");
    const entries = deriveProviderInstanceEntries([provider({ instanceId })]);
    const [entry] = applyProviderInstanceSettings(entries, {
      providerInstances: {
        [instanceId]: {
          driver: ProviderDriverKind.make("pi"),
          enabled: false,
        },
      },
      providers: {} as never,
    });

    expect(entry?.enabled).toBe(false);
  });

  it("treats a removed default instance for a fork driver as disabled", () => {
    const driver = ProviderDriverKind.make("constructor");
    const entries = deriveProviderInstanceEntries([
      provider({ provider: driver, instanceId: "constructor" }),
    ]);
    const [entry] = applyProviderInstanceSettings(entries, {
      providerInstances: {},
      providers: {} as never,
    });

    expect(entry?.isDefault).toBe(true);
    expect(entry?.enabled).toBe(false);
  });

  it("uses legacy settings for a built-in default instance", () => {
    const entries = deriveProviderInstanceEntries([provider({ instanceId: "pi" })]);
    const [entry] = applyProviderInstanceSettings(entries, {
      providerInstances: {},
      providers: { pi: { enabled: false } } as never,
    });

    expect(entry?.enabled).toBe(false);
  });
});

describe("deriveProviderInstanceEntries", () => {
  it("uses explicit instance id and driver kind from the snapshot", () => {
    const snapshot = provider({ instanceId: "pi_personal" });
    const [entry] = deriveProviderInstanceEntries([snapshot]);

    expect(entry?.instanceId).toBe("pi_personal");
    expect(entry?.driverKind).toBe("pi");
    expect(entry?.isDefault).toBe(false);
  });
});

describe("deriveProviderEntriesByEnvironment", () => {
  it("keeps same-id default instances distinct per environment", () => {
    const byEnvironment = deriveProviderEntriesByEnvironment([
      [
        "local",
        [
          provider({
            instanceId: "pi",
            displayName: "Pi Local",
            accentColor: "#112233",
          }),
        ],
      ],
      [
        "remote",
        [
          provider({
            instanceId: "pi",
            displayName: "Pi Remote",
            accentColor: "#445566",
          }),
        ],
      ],
    ]);

    expect(byEnvironment.get("local")?.get("pi")?.displayName).toBe("Pi Local");
    expect(byEnvironment.get("local")?.get("pi")?.accentColor).toBe("#112233");
    expect(byEnvironment.get("remote")?.get("pi")?.displayName).toBe("Pi Remote");
    expect(byEnvironment.get("remote")?.get("pi")?.accentColor).toBe("#445566");
  });

  it("never falls back to another environment's instances", () => {
    const byEnvironment = deriveProviderEntriesByEnvironment([
      ["local", [provider({ instanceId: "pi" })]],
      ["empty", []],
    ]);

    expect(byEnvironment.get("empty")?.get("pi")).toBeUndefined();
    // Every environment gets its own bucket, so an absent lookup is a real
    // "this environment has no such instance", not a missing key.
    expect(byEnvironment.get("empty")?.size).toBe(0);
  });
});

describe("resolveSelectableProviderInstance", () => {
  it("returns the requested instance when it is enabled and available", () => {
    const requested = ProviderInstanceId.make("pi_work");
    const providers = [
      provider({ instanceId: "pi" }),
      provider({ instanceId: requested }),
    ];

    expect(resolveSelectableProviderInstance(providers, requested)).toBe(requested);
  });

  it("falls back to the first enabled and available instance", () => {
    const disabled = ProviderInstanceId.make("pi_work");
    const fallback = ProviderInstanceId.make("pi_default");
    const providers = [
      provider({ instanceId: disabled, enabled: false }),
      provider({ instanceId: fallback }),
    ];

    expect(resolveSelectableProviderInstance(providers, disabled)).toBe(fallback);
  });

  it("prefers a ready instance over an enabled one whose driver cannot start", () => {
    const notInstalled = ProviderInstanceId.make("pi_broken");
    const ready = ProviderInstanceId.make("pi_ready");
    const providers = [
      provider({ instanceId: notInstalled, status: "error" }),
      provider({ instanceId: ready }),
    ];

    expect(resolveSelectableProviderInstance(providers, undefined)).toBe(ready);
  });

  it("prefers an unprobed (warning) instance over one whose probe errored", () => {
    const errored = ProviderInstanceId.make("pi_broken");
    const unprobed = ProviderInstanceId.make("pi_pending");
    const providers = [
      provider({ instanceId: errored, status: "error" }),
      provider({ instanceId: unprobed, status: "warning" }),
    ];

    expect(resolveSelectableProviderInstance(providers, undefined)).toBe(unprobed);
  });

  it("keeps a requested instance even when its probe errored", () => {
    const requested = ProviderInstanceId.make("pi_broken");
    const providers = [
      provider({ instanceId: requested, status: "error" }),
      provider({ instanceId: "pi_ready" }),
    ];

    expect(resolveSelectableProviderInstance(providers, requested)).toBe(requested);
  });

  it("does not invent an errored instance as a new-user default", () => {
    const notInstalled = ProviderInstanceId.make("pi_broken");
    const providers = [provider({ instanceId: notInstalled, status: "error" })];

    expect(resolveSelectableProviderInstance(providers, undefined)).toBeUndefined();
  });

  it("does not return disabled, unavailable, or unknown instances when none are sendable", () => {
    const disabled = ProviderInstanceId.make("pi_disabled");
    const unavailable = ProviderInstanceId.make("pi_unavailable");
    const unknown = ProviderInstanceId.make("removed_instance");
    const providers = [
      provider({ instanceId: disabled, enabled: false }),
      provider({ instanceId: unavailable, availability: "unavailable" }),
    ];

    expect(resolveSelectableProviderInstance(providers, disabled)).toBeUndefined();
    expect(resolveSelectableProviderInstance(providers, unavailable)).toBeUndefined();
    expect(resolveSelectableProviderInstance(providers, unknown)).toBeUndefined();
  });
});

describe("getDefaultProviderInstanceModel", () => {
  it("uses the instance's own models, not the default instance of the kind", () => {
    const providers = [
      provider({
        instanceId: "pi_openrouter",
        models: [model("openai/gpt-5.5", true), model("claude-opus-4-8")],
      }),
      provider({
        instanceId: "pi",
        models: [model("pi-sonic")],
      }),
    ];

    expect(
      getDefaultProviderInstanceModel(providers, ProviderInstanceId.make("pi_openrouter")),
    ).toBe("claude-opus-4-8");
  });

  it("falls back to the driver default when the instance reports no models", () => {
    const providers = [provider({ instanceId: "pi" })];

    const resolved = getDefaultProviderInstanceModel(providers, ProviderInstanceId.make("pi"));
    expect(typeof resolved).toBe("string");
    expect(resolved?.length).toBeGreaterThan(0);
  });

  it("honors the instance's declared default before model-list order", () => {
    const providers = [
      provider({
        instanceId: "pi",
        models: [model("pi-sonic"), model("pi-opus-sol", false, true)],
      }),
    ];

    expect(getDefaultProviderInstanceModel(providers, ProviderInstanceId.make("pi"))).toBe(
      "pi-opus-sol",
    );
  });

  it("returns undefined for an unknown instance", () => {
    expect(
      getDefaultProviderInstanceModel([], ProviderInstanceId.make("removed_instance")),
    ).toBeUndefined();
  });
});

describe("resolveDefaultProviderModelSelection", () => {
  it("uses the only available instance and its declared default model", () => {
    const providers = [
      provider({
        instanceId: "pi",
        models: [model("pi-sonic", false, true)],
      }),
    ];

    expect(resolveDefaultProviderModelSelection(providers, null)).toEqual({
      instanceId: "pi",
      model: "pi-sonic",
    });
  });

  it("preserves a valid stored selection including its options", () => {
    const providers = [
      provider({
        instanceId: "pi",
        models: [model("pi-sonic")],
      }),
    ];
    const stored = {
      instanceId: ProviderInstanceId.make("pi"),
      model: "pi-test-custom-model",
      options: [{ id: "effort", value: "high" }],
    };

    expect(resolveDefaultProviderModelSelection(providers, stored)).toBe(stored);
  });

  it("replaces a stale stored instance with the first ready instance and its model", () => {
    const providers = [
      provider({
        instanceId: "pi_stale",
        status: "warning",
        models: [model("pi-sonic")],
      }),
      provider({
        instanceId: "pi",
        models: [model("pi-opus-sol", false, true)],
      }),
    ];

    expect(
      resolveDefaultProviderModelSelection(providers, {
        instanceId: ProviderInstanceId.make("removed-instance"),
        model: "stale-model",
      }),
    ).toEqual({ instanceId: "pi", model: "pi-opus-sol" });
  });

  it.each([{ enabled: false }, { availability: "unavailable" as const }])(
    "replaces an unavailable stored instance deterministically",
    (requestedState) => {
      const providers = [
        provider({
          instanceId: "pi_unusable",
          models: [model("pi-sonic")],
          ...requestedState,
        }),
        provider({
          instanceId: "pi",
          models: [model("pi-opus-sol", false, true)],
        }),
      ];

      expect(
        resolveDefaultProviderModelSelection(providers, {
          instanceId: ProviderInstanceId.make("pi_unusable"),
          model: "pi-sonic",
        }),
      ).toEqual({ instanceId: "pi", model: "pi-opus-sol" });
    },
  );

  it("returns no selection for empty, disabled, unavailable, or error-only profiles", () => {
    expect(resolveDefaultProviderModelSelection([], null)).toBeNull();
    expect(
      resolveDefaultProviderModelSelection(
        [provider({ instanceId: "pi", enabled: false })],
        null,
      ),
    ).toBeNull();
    expect(
      resolveDefaultProviderModelSelection(
        [provider({ instanceId: "pi", availability: "unavailable" })],
        null,
      ),
    ).toBeNull();
    expect(
      resolveDefaultProviderModelSelection(
        [provider({ instanceId: "pi", status: "error" })],
        null,
      ),
    ).toBeNull();
  });
});
