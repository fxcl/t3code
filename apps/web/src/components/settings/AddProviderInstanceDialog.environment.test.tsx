import { EnvironmentId, type ProviderInstanceId } from "@t3tools/contracts";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { visitElements } from "../../test/reactElementTree";
import { reactHookHarness as hooks } from "../../test/reactHookHarness";

const settingsHooks = vi.hoisted(() => ({
  read: vi.fn(() => ({ providerInstances: {} })),
  mutate: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const { reactHookHarness } = await import("../../test/reactHookHarness");
  return {
    ...actual,
    useMemo: reactHookHarness.useMemo,
    useState: reactHookHarness.useState,
  };
});

vi.mock("react/compiler-runtime", async () => {
  const { reactHookHarness } = await import("../../test/reactHookHarness");
  return { c: reactHookHarness.useMemoCache };
});

vi.mock("@t3tools/client-runtime/state/runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@t3tools/client-runtime/state/runtime")>()),
  squashAtomCommandFailure: () => new Error("The settings update failed."),
}));

vi.mock("../../hooks/useSettings", () => ({
  useEnvironmentSettings: settingsHooks.read,
  usePersistEnvironmentProviderInstanceMutation: settingsHooks.useMutation,
}));

import { AddProviderInstanceDialog } from "./AddProviderInstanceDialog";

const remoteEnvironmentId = EnvironmentId.make("remote-device");

function render(onOpenChange = vi.fn(), onCreated?: (instanceId: ProviderInstanceId) => void) {
  hooks.beginRender();
  return AddProviderInstanceDialog({
    open: true,
    environmentId: remoteEnvironmentId,
    environmentLabel: "Remote device",
    onOpenChange,
    ...(onCreated === undefined ? {} : { onCreated }),
  });
}

function findByChildren(tree: ReturnType<typeof render>, children: string) {
  const result = visitElements(tree, (element) => element.props.children === children);
  expect(result).not.toBeNull();
  return result!;
}

function findInput(tree: ReturnType<typeof render>, id: string) {
  const result = visitElements(tree, (element) => element.props.id === id);
  expect(result).not.toBeNull();
  return result!.props as {
    readonly value: string;
    readonly onChange: (event: { target: { value: string } }) => void;
  };
}

/** Walk to the identity step and type a label into it. */
function renderIdentityStepWithLabel(
  onOpenChange = vi.fn(),
  onCreated?: (instanceId: ProviderInstanceId) => void,
  label = "Work",
) {
  let tree = render(onOpenChange, onCreated);
  (findByChildren(tree, "Next").props.onClick as () => void)();
  tree = render(onOpenChange, onCreated);
  findInput(tree, "add-provider-label").onChange({ target: { value: label } });
  tree = render(onOpenChange, onCreated);
  return tree;
}

describe("AddProviderInstanceDialog environment routing", () => {
  beforeEach(() => {
    hooks.reset();
    settingsHooks.read.mockReset().mockReturnValue({ providerInstances: {} });
    settingsHooks.mutate.mockReset().mockResolvedValue({ _tag: "Success", value: {} });
    settingsHooks.useMutation.mockReset().mockReturnValue(settingsHooks.mutate);
  });

  it("derives the instance id from the typed label and creates the instance", async () => {
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    let tree = renderIdentityStepWithLabel(onOpenChange, onCreated);
    expect(findInput(tree, "add-provider-instance-id").value).toBe("pi_work");
    (findByChildren(tree, "Next").props.onClick as () => void)();
    tree = render(onOpenChange, onCreated);
    (findByChildren(tree, "Add instance").props.onClick as () => void)();
    await Promise.resolve();
    expect(settingsHooks.mutate).toHaveBeenCalledWith({
      operation: "create",
      instanceId: "pi_work",
      instance: { driver: "pi", enabled: true, displayName: "Work" },
    });
    expect(onCreated).toHaveBeenCalledWith("pi_work");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks a duplicate instance id and accepts an explicit override", async () => {
    settingsHooks.read.mockReturnValue({
      providerInstances: {
        pi_work: { driver: "pi", enabled: true },
      },
    });
    const onOpenChange = vi.fn();
    let tree = renderIdentityStepWithLabel(onOpenChange);
    expect(findInput(tree, "add-provider-instance-id").value).toBe("pi_work");
    // Forward navigation past identity is blocked while the id collides.
    (findByChildren(tree, "Next").props.onClick as () => void)();
    tree = render(onOpenChange);
    expect(findInput(tree, "add-provider-label")).not.toBeNull();
    findInput(tree, "add-provider-instance-id").onChange({
      target: { value: "pi_work_2" },
    });
    tree = render(onOpenChange);
    (findByChildren(tree, "Next").props.onClick as () => void)();
    tree = render(onOpenChange);
    (findByChildren(tree, "Add instance").props.onClick as () => void)();
    await Promise.resolve();
    expect(settingsHooks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "create", instanceId: "pi_work_2" }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("reads and writes settings through the supplied environment", () => {
    render();

    expect(settingsHooks.read).toHaveBeenCalledWith(remoteEnvironmentId);
    expect(settingsHooks.useMutation).toHaveBeenCalledWith(remoteEnvironmentId);
  });

  it("awaits an atomic create before closing", async () => {
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    let resolveMutation!: (value: { readonly _tag: "Success"; readonly value: unknown }) => void;
    settingsHooks.mutate.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMutation = resolve;
      }),
    );
    let tree = renderIdentityStepWithLabel(onOpenChange, onCreated);
    (findByChildren(tree, "Next").props.onClick as () => void)();
    tree = render(onOpenChange, onCreated);
    (findByChildren(tree, "Add instance").props.onClick as () => void)();
    await Promise.resolve();
    expect(settingsHooks.mutate).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();

    resolveMutation({ _tag: "Success", value: {} });
    await Promise.resolve();
    await Promise.resolve();
    expect(onCreated).toHaveBeenCalledWith("pi_work");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog open when the atomic upsert fails", async () => {
    settingsHooks.mutate.mockResolvedValueOnce({ _tag: "Failure", cause: new Error("Conflict") });
    const onOpenChange = vi.fn();
    let tree = renderIdentityStepWithLabel(onOpenChange);
    (findByChildren(tree, "Next").props.onClick as () => void)();
    tree = render(onOpenChange);
    (findByChildren(tree, "Add instance").props.onClick as () => void)();
    await Promise.resolve();
    await Promise.resolve();

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
