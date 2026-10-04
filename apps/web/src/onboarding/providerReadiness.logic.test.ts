import {
  DEFAULT_SERVER_SETTINGS,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  getOnboardingProviderState,
  resolveOnboardingProviderInstallCommand,
  resolveOnboardingProviderLoginCommand,
  selectOnboardingProvidersByDriver,
} from "./providerReadiness.logic";

const PI_INSTALL_COMMAND = "npm install -g @earendil-works/pi-coding-agent";

const readyPi: ServerProvider = {
  instanceId: ProviderInstanceId.make("pi"),
  driver: ProviderDriverKind.make("pi"),
  enabled: true,
  installed: true,
  version: "1.0.0",
  status: "ready",
  auth: { status: "unknown" },
  checkedAt: "2026-08-23T00:00:00.000Z",
  models: [],
  slashCommands: [],
  skills: [],
};

describe("getOnboardingProviderState", () => {
  it("treats an enabled Pi provider with ready status and unknown authentication as ready", () => {
    expect(getOnboardingProviderState(readyPi)).toBe("ready");
  });

  it("treats authenticated providers as ready only when their provider status is ready", () => {
    expect(getOnboardingProviderState({ ...readyPi, auth: { status: "authenticated" } })).toBe(
      "ready",
    );
    expect(
      getOnboardingProviderState({
        ...readyPi,
        auth: { status: "authenticated" },
        status: "error",
      }),
    ).toBe("attention");
    expect(
      getOnboardingProviderState({
        ...readyPi,
        auth: { status: "authenticated" },
        status: "warning",
      }),
    ).toBe("attention");
  });

  it("offers sign-in only when the server reports an authentication failure", () => {
    expect(
      getOnboardingProviderState({
        ...readyPi,
        status: "error",
        auth: { status: "unauthenticated" },
      }),
    ).toBe("signIn");
    expect(getOnboardingProviderState({ ...readyPi, status: "error" })).toBe("attention");
    expect(getOnboardingProviderState({ ...readyPi, status: "warning" })).toBe("attention");
  });

  it("does not offer installation or sign-in for disabled providers", () => {
    expect(getOnboardingProviderState({ ...readyPi, enabled: false, installed: false })).toBe(
      "disabled",
    );
    expect(getOnboardingProviderState({ ...readyPi, status: "disabled" })).toBe("disabled");
  });

  it("offers installation only when an enabled provider is missing", () => {
    expect(getOnboardingProviderState({ ...readyPi, installed: false, status: "error" })).toBe(
      "install",
    );
  });

  it("waits for a provider snapshot before offering an action", () => {
    expect(getOnboardingProviderState(undefined)).toBe("checking");
  });
});

describe("selectOnboardingProvidersByDriver", () => {
  it("prefers a ready instance with unknown authentication to an unauthenticated instance", () => {
    const signedOutPi: ServerProvider = {
      ...readyPi,
      instanceId: ProviderInstanceId.make("pi_work"),
      status: "error",
      auth: { status: "unauthenticated" },
    };

    expect(selectOnboardingProvidersByDriver([signedOutPi, readyPi]).get("pi")).toBe(readyPi);
  });

  it("prefers a provider with an actionable sign-in over a failed provider", () => {
    const failedPi: ServerProvider = { ...readyPi, status: "error" };
    const signedOutPi: ServerProvider = {
      ...readyPi,
      instanceId: ProviderInstanceId.make("pi_work"),
      status: "error",
      auth: { status: "unauthenticated" },
    };

    expect(selectOnboardingProvidersByDriver([failedPi, signedOutPi]).get("pi")).toBe(signedOutPi);
  });

  it("prefers installed providers over missing or disabled instances", () => {
    const disabledPi: ServerProvider = { ...readyPi, enabled: false };
    const missingPi: ServerProvider = {
      ...readyPi,
      instanceId: ProviderInstanceId.make("pi_work"),
      installed: false,
      status: "error",
    };

    expect(selectOnboardingProvidersByDriver([disabledPi, missingPi, readyPi]).get("pi")).toBe(
      readyPi,
    );
  });

  it("handles provider snapshots that have not arrived", () => {
    expect(selectOnboardingProvidersByDriver(undefined).size).toBe(0);
  });

  it("keeps a ready custom account when the default account is signed out", () => {
    const signedOutDefault: ServerProvider = {
      ...readyPi,
      status: "error",
      auth: { status: "unauthenticated" },
    };
    const readyCustom: ServerProvider = {
      ...readyPi,
      instanceId: ProviderInstanceId.make("pi_work"),
    };

    expect(selectOnboardingProvidersByDriver([signedOutDefault, readyCustom]).get("pi")).toBe(
      readyCustom,
    );
  });
});

describe("resolveOnboardingProviderLoginCommand", () => {
  it("uses the selected Pi account binary without a login subcommand", () => {
    const provider = { ...readyPi, instanceId: ProviderInstanceId.make("pi_work") };

    expect(
      resolveOnboardingProviderLoginCommand(
        provider,
        {
          ...DEFAULT_SERVER_SETTINGS,
          providerInstances: {
            [provider.instanceId]: {
              driver: provider.driver,
              config: { binaryPath: "/opt/pi-work/bin/pi" },
            },
          },
        },
        "linux",
      ),
    ).toBe("/opt/pi-work/bin/pi");
  });

  it("falls back to the default-slot Pi settings when the instance is unknown", () => {
    expect(
      resolveOnboardingProviderLoginCommand(
        readyPi,
        {
          ...DEFAULT_SERVER_SETTINGS,
          providers: {
            ...DEFAULT_SERVER_SETTINGS.providers,
            pi: {
              ...DEFAULT_SERVER_SETTINGS.providers.pi,
              binaryPath: "/opt/custom-pi/pi",
            },
          },
        },
        "linux",
      ),
    ).toBe("/opt/custom-pi/pi");
  });

  it("quotes a Pi path with spaces for PowerShell", () => {
    expect(
      resolveOnboardingProviderLoginCommand(
        readyPi,
        {
          ...DEFAULT_SERVER_SETTINGS,
          providers: {
            ...DEFAULT_SERVER_SETTINGS.providers,
            pi: {
              ...DEFAULT_SERVER_SETTINGS.providers.pi,
              binaryPath: "C:\\Program Files\\Pi & Tools\\pi.exe",
            },
          },
        },
        "windows",
      ),
    ).toBe("& 'C:\\Program Files\\Pi & Tools\\pi.exe'");
  });

  it.each([
    ["~/my tools/pi", "~/'my tools/pi'"],
    ["~\\my tools/pi", "~/'my tools/pi'"],
    ["~/tools/pi's build", `~/'tools/pi'"'"'s build'`],
    ["~\\tools\\pi's build", `~/'tools\\pi'"'"'s build'`],
    ["~/tools/pi; echo unsafe", "~/'tools/pi; echo unsafe'"],
  ])("keeps the home prefix expandable while quoting %s", (binaryPath, expectedCommand) => {
    expect(
      resolveOnboardingProviderLoginCommand(
        readyPi,
        {
          ...DEFAULT_SERVER_SETTINGS,
          providers: {
            ...DEFAULT_SERVER_SETTINGS.providers,
            pi: {
              ...DEFAULT_SERVER_SETTINGS.providers.pi,
              binaryPath,
            },
          },
        },
        "linux",
      ),
    ).toBe(expectedCommand);
  });

  it.each(["darwin", "linux"] as const)("quotes backslashes in a Pi path on %s", (platform) => {
    expect(
      resolveOnboardingProviderLoginCommand(
        readyPi,
        {
          ...DEFAULT_SERVER_SETTINGS,
          providers: {
            ...DEFAULT_SERVER_SETTINGS.providers,
            pi: {
              ...DEFAULT_SERVER_SETTINGS.providers.pi,
              binaryPath: "/opt/pi\\work/pi",
            },
          },
        },
        platform,
      ),
    ).toBe("'/opt/pi\\work/pi'");
  });

  it("keeps a plain Windows path unquoted", () => {
    expect(
      resolveOnboardingProviderLoginCommand(
        readyPi,
        {
          ...DEFAULT_SERVER_SETTINGS,
          providers: {
            ...DEFAULT_SERVER_SETTINGS.providers,
            pi: {
              ...DEFAULT_SERVER_SETTINGS.providers.pi,
              binaryPath: "C:\\Tools\\pi.exe",
            },
          },
        },
        "windows",
      ),
    ).toBe("C:\\Tools\\pi.exe");
  });

  it("uses the default command when an old server reports an unknown shell", () => {
    expect(
      resolveOnboardingProviderLoginCommand(
        readyPi,
        {
          ...DEFAULT_SERVER_SETTINGS,
          providers: {
            ...DEFAULT_SERVER_SETTINGS.providers,
            pi: {
              ...DEFAULT_SERVER_SETTINGS.providers.pi,
              binaryPath: "/opt/Pi Tools/pi",
            },
          },
        },
        "unknown",
      ),
    ).toBe("pi");
  });
});

describe("resolveOnboardingProviderInstallCommand", () => {
  it("installs Pi through the global npm package on Windows environments", () => {
    expect(resolveOnboardingProviderInstallCommand("pi", "windows")).toBe(PI_INSTALL_COMMAND);
  });

  it.each(["darwin", "linux", "unknown"] as const)("installs Pi through npm on %s", (platform) => {
    expect(resolveOnboardingProviderInstallCommand("pi", platform)).toBe(PI_INSTALL_COMMAND);
  });
});
