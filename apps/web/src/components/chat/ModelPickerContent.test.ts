import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { deriveProviderInstanceEntries } from "../../providerInstances";
import {
  adjacentModelPickerProvider,
  resolveModelPickerSelectedModel,
  shouldIncludeModelPickerOption,
  shouldOfferModelPickerSetup,
} from "./ModelPickerContent";

function entry(
  status: ServerProvider["status"],
  instanceId = "pi_work",
  overrides: Partial<ServerProvider> = {},
) {
  return deriveProviderInstanceEntries([
    {
      instanceId: ProviderInstanceId.make(instanceId),
      driver: ProviderDriverKind.make("pi"),
      enabled: true,
      installed: true,
      version: null,
      status,
      auth: { status: "authenticated" },
      checkedAt: "2026-08-28T00:00:00.000Z",
      models: [],
      slashCommands: [],
      skills: [],
      ...overrides,
    },
  ])[0]!;
}

describe("shouldIncludeModelPickerOption", () => {
  it("offers every option once the provider is picker-ready", () => {
    const providerEntry = entry("ready");
    expect(
      shouldIncludeModelPickerOption({
        entry: providerEntry,
        option: { slug: "pi-sonic", name: "Pi Sonic" },
        activeInstanceId: providerEntry.instanceId,
        activeModel: "pi-sonic",
      }),
    ).toBe(true);
  });

  it.each(["error", "warning"] as const)(
    "keeps only the active synthetic unavailable row when the provider status is %s",
    (status) => {
      const providerEntry = entry(status);
      const activeInstanceId = providerEntry.instanceId;
      const activeModel = "missing-model";

      expect(
        shouldIncludeModelPickerOption({
          entry: providerEntry,
          option: {
            slug: activeModel,
            name: activeModel,
            isUnavailable: true,
          },
          activeInstanceId,
          activeModel,
        }),
      ).toBe(true);
      expect(
        shouldIncludeModelPickerOption({
          entry: providerEntry,
          option: { slug: "stale/model", name: "Stale model" },
          activeInstanceId,
          activeModel,
        }),
      ).toBe(false);
      expect(
        shouldIncludeModelPickerOption({
          entry: providerEntry,
          option: {
            slug: "other/missing",
            name: "Other missing",
            isUnavailable: true,
          },
          activeInstanceId,
          activeModel,
        }),
      ).toBe(false);
      expect(
        shouldIncludeModelPickerOption({
          entry: providerEntry,
          option: { slug: activeModel, name: activeModel, isUnavailable: true },
          activeInstanceId: ProviderInstanceId.make("pi_personal"),
          activeModel,
        }),
      ).toBe(false);
    },
  );
});

describe("resolveModelPickerSelectedModel", () => {
  it("selects the option matching the saved model slug", () => {
    const options = [
      { slug: "pi-sonic", name: "Pi Sonic" },
      { slug: "pi-opus", name: "Pi Opus" },
    ];

    expect(
      resolveModelPickerSelectedModel({
        driverKind: ProviderDriverKind.make("pi"),
        model: "pi-opus",
        options,
      })?.slug,
    ).toBe("pi-opus");
  });

  it("does not guess the default from the first model in a catalog", () => {
    expect(
      resolveModelPickerSelectedModel({
        driverKind: ProviderDriverKind.make("pi"),
        model: "not-in-catalog",
        options: [{ slug: "pi-sonic", name: "Pi Sonic" }],
      }),
    ).toBeUndefined();
  });
});

describe("shouldOfferModelPickerSetup", () => {
  const piSetup = { canAuthenticate: true, canInstall: true };
  const availableModel = { slug: "pi-sonic", name: "Pi Sonic" };

  it("offers setup before the Pi account has models", () => {
    expect(shouldOfferModelPickerSetup(entry("error", "pi_work", { setup: piSetup }), [])).toBe(
      true,
    );
  });

  it("offers setup after sign-out even if a model remains cached", () => {
    const providerEntry = entry("ready", "pi_work", { setup: piSetup });
    expect(
      shouldOfferModelPickerSetup(
        {
          ...providerEntry,
          snapshot: { ...providerEntry.snapshot, auth: { status: "unauthenticated" } },
        },
        [availableModel],
      ),
    ).toBe(true);
  });

  it("offers setup when the only model is an unavailable saved selection", () => {
    expect(
      shouldOfferModelPickerSetup(entry("ready", "pi_work", { setup: piSetup }), [
        { ...availableModel, isUnavailable: true },
      ]),
    ).toBe(true);
  });

  it("does not offer setup for a ready account with available models", () => {
    expect(
      shouldOfferModelPickerSetup(entry("ready", "pi_work", { setup: piSetup }), [availableModel]),
    ).toBe(false);
  });

  it("does not offer setup without a snapshot setup capability", () => {
    expect(shouldOfferModelPickerSetup(entry("error", "pi_plain"), [])).toBe(false);
  });

  it("does not restore a disabled provider while its status snapshot is stale", () => {
    expect(
      shouldOfferModelPickerSetup(
        { ...entry("error", "pi_work", { setup: piSetup }), enabled: false },
        [],
      ),
    ).toBe(false);
  });

  it("uses the environment's setup capability for other drivers", () => {
    const providerEntry = entry("error", "custom_work", {
      driver: ProviderDriverKind.make("custom_driver"),
      setup: { canAuthenticate: true, canInstall: false },
    });
    expect(shouldOfferModelPickerSetup(providerEntry, [])).toBe(true);
  });
});

describe("adjacentModelPickerProvider", () => {
  const first = entry("ready");
  const second = entry("ready", "pi_personal");
  const unavailable = entry("error", "pi_broken");
  const input = {
    entries: [first, unavailable, second],
    disabledInstanceIds: undefined,
    selectableUnavailableInstanceIds: undefined,
  };

  it("wraps through favorites and ready instances, skipping unavailable providers", () => {
    expect(
      adjacentModelPickerProvider({ ...input, selectedInstanceId: first.instanceId, direction: 1 }),
    ).toBe(second.instanceId);
    expect(
      adjacentModelPickerProvider({ ...input, selectedInstanceId: "favorites", direction: -1 }),
    ).toBe(second.instanceId);
    expect(
      adjacentModelPickerProvider({
        ...input,
        selectedInstanceId: second.instanceId,
        direction: 1,
      }),
    ).toBe("favorites");
  });

  it("keeps thread locks and the selected unavailable catalog", () => {
    expect(
      adjacentModelPickerProvider({
        ...input,
        disabledInstanceIds: new Set([second.instanceId]),
        selectedInstanceId: first.instanceId,
        direction: 1,
      }),
    ).toBe("favorites");
    expect(
      adjacentModelPickerProvider({
        ...input,
        selectableUnavailableInstanceIds: new Set([unavailable.instanceId]),
        selectedInstanceId: first.instanceId,
        direction: 1,
      }),
    ).toBe(unavailable.instanceId);
  });

  it("handles an empty catalog and a removed selection in either direction", () => {
    expect(
      adjacentModelPickerProvider({
        ...input,
        entries: [],
        selectedInstanceId: first.instanceId,
        direction: -1,
      }),
    ).toBe("favorites");
    expect(
      adjacentModelPickerProvider({
        ...input,
        selectedInstanceId: unavailable.instanceId,
        direction: 1,
      }),
    ).toBe("favorites");
    expect(
      adjacentModelPickerProvider({
        ...input,
        selectedInstanceId: unavailable.instanceId,
        direction: -1,
      }),
    ).toBe(second.instanceId);
  });
});
