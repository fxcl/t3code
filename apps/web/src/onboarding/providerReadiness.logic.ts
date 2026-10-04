import {
  PiSettings,
  type ExecutionEnvironmentPlatformOs,
  type ServerProvider,
  type ServerSettings,
} from "@t3tools/contracts";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const decodePiSettings = Schema.decodeUnknownOption(PiSettings);
const SAFE_SHELL_BINARY_PATTERN = /^[A-Za-z0-9_./:\\-]+$/;

function quoteProviderBinary(
  binaryPath: string,
  fallback: string,
  platform: ExecutionEnvironmentPlatformOs,
): string {
  if (
    SAFE_SHELL_BINARY_PATTERN.test(binaryPath) &&
    (platform === "windows" || !binaryPath.includes("\\"))
  ) {
    return binaryPath;
  }
  if (platform === "windows") return `& '${binaryPath.replaceAll("'", "''")}'`;
  if (platform === "darwin" || platform === "linux") {
    if (binaryPath.startsWith("~/") || binaryPath.startsWith("~\\")) {
      return `~/'${binaryPath.slice(2).replaceAll("'", `'"'"'`)}'`;
    }
    return `'${binaryPath.replaceAll("'", `'"'"'`)}'`;
  }
  return fallback;
}

export function getOnboardingProviderState(provider: ServerProvider | undefined) {
  if (provider === undefined) return "checking";
  if (!provider.enabled || provider.status === "disabled") return "disabled";
  if (!provider.installed && provider.status === "warning" && provider.auth.status === "unknown")
    return "checking";
  if (!provider.installed) return "install";
  if (provider.auth.status === "unauthenticated") return "signIn";
  if (provider.status === "ready") return "ready";
  return "attention";
}

const PROVIDER_STATE_PRIORITY = {
  checking: 0,
  disabled: 1,
  install: 2,
  attention: 3,
  signIn: 4,
  ready: 5,
} as const;

/** Select the most usable configured instance for each provider driver. */
export function selectOnboardingProvidersByDriver(
  providers: ReadonlyArray<ServerProvider> | null | undefined,
) {
  const providersByDriver = new Map<string, ServerProvider>();

  for (const provider of providers ?? []) {
    const existing = providersByDriver.get(provider.driver);
    if (
      existing === undefined ||
      PROVIDER_STATE_PRIORITY[getOnboardingProviderState(provider)] >
        PROVIDER_STATE_PRIORITY[getOnboardingProviderState(existing)]
    ) {
      providersByDriver.set(provider.driver, provider);
    }
  }

  return providersByDriver;
}

/**
 * Pi ships as a global npm package, so one command installs it everywhere;
 * npm is the only prerequisite and the paths it lands in are the ones the
 * server's provider maintenance recognizes as native, so the one-click
 * updater in Settings keeps working after install.
 */
const NATIVE_INSTALL_COMMANDS = {
  pi: {
    windows: "npm install -g @earendil-works/pi-coding-agent",
    posix: "npm install -g @earendil-works/pi-coding-agent",
  },
} as const;

/**
 * Install command for the setup terminal, keyed on the environment's platform
 * (not the client's): a Windows desktop driving a WSL server gets the shell
 * command. Unknown platforms get the shell command too, since the terminal
 * there is a POSIX shell in practice.
 */
export function resolveOnboardingProviderInstallCommand(
  driver: keyof typeof NATIVE_INSTALL_COMMANDS,
  platform: ExecutionEnvironmentPlatformOs,
): string {
  const commands = NATIVE_INSTALL_COMMANDS[driver];
  return platform === "windows" ? commands.windows : commands.posix;
}

/**
 * Use the selected provider instance's binary when the setup terminal opens
 * its sign-in flow. Pi authenticates from its own TUI (`/login`), so the
 * pre-typed command just launches it; the user reviews, presses Enter, and
 * runs `/login` inside.
 */
export function resolveOnboardingProviderLoginCommand(
  provider: ServerProvider,
  settings: ServerSettings,
  platform: ExecutionEnvironmentPlatformOs,
): string {
  const instance = settings.providerInstances[provider.instanceId];

  if (provider.driver === "pi") {
    const config = decodePiSettings(
      instance ? (instance.config ?? {}) : settings.providers.pi,
    );
    const binaryPath = Option.isSome(config) ? config.value.binaryPath : "pi";
    return quoteProviderBinary(binaryPath, "pi", platform);
  }

  return provider.driver;
}
