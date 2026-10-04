import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { deriveProviderInstanceEntries } from "../../providerInstances";
import { ProviderModelPicker } from "./ProviderModelPicker";
import type { ModelEsque } from "./providerIconUtils";

function providerEntry(instanceId: string, driver = "pi") {
  const provider: ServerProvider = {
    instanceId: ProviderInstanceId.make(instanceId),
    driver: ProviderDriverKind.make(driver),
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-08-28T00:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
  };
  return deriveProviderInstanceEntries([provider])[0]!;
}

function renderPicker(input: {
  instanceId: string;
  driver?: string;
  model: string;
  options: ReadonlyArray<ModelEsque>;
  includeEntry?: boolean;
  triggerLabel?: string;
}) {
  const instanceId = ProviderInstanceId.make(input.instanceId);
  const entry = providerEntry(input.instanceId, input.driver ?? "pi");
  return renderToStaticMarkup(
    <ProviderModelPicker
      activeInstanceId={instanceId}
      model={input.model}
      lockedProvider={null}
      instanceEntries={input.includeEntry === false ? [] : [entry]}
      modelOptionsByInstance={new Map([[instanceId, input.options]])}
      onInstanceModelChange={() => {}}
      {...(input.triggerLabel ? { triggerLabel: input.triggerLabel } : {})}
    />,
  );
}

describe("ProviderModelPicker", () => {
  it("shows a neutral aggregate value without a representative model or availability badge", () => {
    const markup = renderPicker({
      instanceId: "pi_personal",
      model: "pi-sonic",
      options: [{ slug: "pi-sonic", name: "Pi Sonic", isUnavailable: true }],
      triggerLabel: "Mixed values",
    });
    expect(markup).toContain("Mixed values");
    expect(markup).not.toContain("Pi Sonic");
    expect(markup).not.toContain("Unavailable");
  });

  it("shows a choice prompt before the Pi account has a catalog", () => {
    const markup = renderPicker({
      instanceId: "pi",
      model: "",
      options: [],
    });

    expect(markup).toContain("Choose model");
  });

  it("keeps the saved model label while it survives as an unavailable row", () => {
    const markup = renderPicker({
      instanceId: "pi",
      model: "pi-sonic",
      options: [{ slug: "pi-sonic", name: "Pi Sonic", isUnavailable: true }],
    });

    expect(markup).toContain("Pi Sonic");
    expect(markup).toContain("Unavailable");
  });

  it("uses the first option label for a missing model", () => {
    const markup = renderPicker({
      instanceId: "pi_work",
      model: "missing-model",
      options: [{ slug: "fallback-model", name: "Fallback model" }],
    });

    expect(markup).toContain("Fallback model");
    expect(markup).not.toContain(">missing-model<");
  });

  it("prefers a matching model over the first option", () => {
    const markup = renderPicker({
      instanceId: "pi_team",
      model: "team/selected",
      options: [
        { slug: "team/fallback", name: "Fallback model" },
        { slug: "team/selected", name: "Selected model" },
      ],
    });

    expect(markup).toContain("Selected model");
    expect(markup).not.toContain("Fallback model");
  });

  it("uses the first option when the active instance entry is missing", () => {
    const markup = renderPicker({
      instanceId: "missing_instance",
      model: "missing-model",
      options: [{ slug: "fallback-model", name: "Fallback model" }],
      includeEntry: false,
    });

    expect(markup).toContain("Fallback model");
    expect(markup).not.toContain(">missing-model<");
  });

  it("keeps instance initials visible in the resting trigger", () => {
    const activeEntry = providerEntry("custom_personal", "custom_driver");
    const markup = renderToStaticMarkup(
      <ProviderModelPicker
        activeInstanceId={activeEntry.instanceId}
        model="pi-sonic"
        lockedProvider={null}
        instanceEntries={[providerEntry("custom", "custom_driver"), activeEntry]}
        modelOptionsByInstance={new Map()}
        size="xs"
        onInstanceModelChange={() => {}}
      />,
    );

    expect(markup).toContain(">CP</span>");
  });
});
