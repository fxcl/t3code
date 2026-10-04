import { describe, expect, it } from "@effect/vitest";

import {
  type ModelSelection,
  type OrchestrationV2ProviderCapabilities,
  ProviderInstanceId,
} from "@t3tools/contracts";

import { PiProviderCapabilitiesV2 } from "./Adapters/PiAdapterV2.ts";
import { acpSelectionTransition } from "./ProviderSelectionTransition.ts";

const selection = (model: string, effort = "medium"): ModelSelection => ({
  instanceId: ProviderInstanceId.make("acp_test"),
  model,
  options: [{ id: "effort", value: effort }],
});

describe("acpSelectionTransition", () => {
  it("rejects model changes when the negotiated session cannot apply them", () => {
    expect(
      acpSelectionTransition({
        current: selection("old"),
        target: selection("new"),
        sessionCapabilities: PiProviderCapabilitiesV2,
      }).type,
    ).toBe("reject");
  });

  it("allows model changes when the negotiated session can apply them", () => {
    const sessionCapabilities: OrchestrationV2ProviderCapabilities = {
      ...PiProviderCapabilitiesV2,
      sessions: {
        ...PiProviderCapabilitiesV2.sessions,
        supportsModelSwitchInSession: true,
      },
    };
    expect(
      acpSelectionTransition({
        current: selection("old"),
        target: selection("new"),
        sessionCapabilities,
      }),
    ).toEqual({ type: "apply_on_next_turn" });
  });

  it("allows option-only changes to be applied through ACP config options", () => {
    expect(
      acpSelectionTransition({
        current: selection("same", "medium"),
        target: selection("same", "high"),
        sessionCapabilities: PiProviderCapabilitiesV2,
      }),
    ).toEqual({ type: "apply_on_next_turn" });
  });
});
