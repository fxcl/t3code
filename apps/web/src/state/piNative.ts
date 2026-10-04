import { PI_NATIVE_WS_METHODS } from "@t3tools/contracts";
import { createEnvironmentRpcCommand } from "@t3tools/client-runtime/state/runtime";

import { connectionAtomRuntime } from "../connection/runtime";

/**
 * One imperative command per Pi-native RPC surface. The Pi command dialogs
 * (`PiNativeCommandDialog`, `PiManagementCommandDialog`) call these directly
 * instead of binding them to reactive queries: each invocation is a discrete
 * user action scoped to the thread the dialog is open on.
 */
export const piNativeEnvironment = {
  getTree: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:get-tree",
    tag: PI_NATIVE_WS_METHODS.getTree,
  }),
  navigateTree: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:navigate-tree",
    tag: PI_NATIVE_WS_METHODS.navigateTree,
  }),
  abortBranchSummary: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:abort-branch-summary",
    tag: PI_NATIVE_WS_METHODS.abortBranchSummary,
  }),
  setEntryLabel: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:set-entry-label",
    tag: PI_NATIVE_WS_METHODS.setEntryLabel,
  }),
  reload: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:reload",
    tag: PI_NATIVE_WS_METHODS.reload,
  }),
  compact: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:compact",
    tag: PI_NATIVE_WS_METHODS.compact,
  }),
  getStateAndStats: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:get-state-and-stats",
    tag: PI_NATIVE_WS_METHODS.getStateAndStats,
  }),
  setSessionName: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:set-session-name",
    tag: PI_NATIVE_WS_METHODS.setSessionName,
  }),
  getLastAssistantText: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:get-last-assistant-text",
    tag: PI_NATIVE_WS_METHODS.getLastAssistantText,
  }),
  exportHtml: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:export-html",
    tag: PI_NATIVE_WS_METHODS.exportHtml,
  }),
  getSettings: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:get-settings",
    tag: PI_NATIVE_WS_METHODS.getSettings,
  }),
  updateSettings: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:update-settings",
    tag: PI_NATIVE_WS_METHODS.updateSettings,
  }),
  getScopedModels: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:get-scoped-models",
    tag: PI_NATIVE_WS_METHODS.getScopedModels,
  }),
  updateScopedModels: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:update-scoped-models",
    tag: PI_NATIVE_WS_METHODS.updateScopedModels,
  }),
  listResumeSessions: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:list-resume-sessions",
    tag: PI_NATIVE_WS_METHODS.listResumeSessions,
  }),
  resume: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:resume",
    tag: PI_NATIVE_WS_METHODS.resume,
  }),
  importSession: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:import-session",
    tag: PI_NATIVE_WS_METHODS.importSession,
  }),
  fork: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:fork",
    tag: PI_NATIVE_WS_METHODS.fork,
  }),
  clone: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:clone",
    tag: PI_NATIVE_WS_METHODS.clone,
  }),
  getTrust: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:get-trust",
    tag: PI_NATIVE_WS_METHODS.getTrust,
  }),
  setTrust: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:set-trust",
    tag: PI_NATIVE_WS_METHODS.setTrust,
  }),
  getChangelog: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:get-changelog",
    tag: PI_NATIVE_WS_METHODS.getChangelog,
  }),
  getAuthState: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:get-auth-state",
    tag: PI_NATIVE_WS_METHODS.getAuthState,
  }),
  beginAuthLogin: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:begin-auth-login",
    tag: PI_NATIVE_WS_METHODS.beginAuthLogin,
  }),
  getAuthFlow: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:get-auth-flow",
    tag: PI_NATIVE_WS_METHODS.getAuthFlow,
  }),
  respondAuthFlow: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:respond-auth-flow",
    tag: PI_NATIVE_WS_METHODS.respondAuthFlow,
  }),
  cancelAuthFlow: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:cancel-auth-flow",
    tag: PI_NATIVE_WS_METHODS.cancelAuthFlow,
  }),
  logout: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:logout",
    tag: PI_NATIVE_WS_METHODS.logout,
  }),
  share: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "pi-native:share",
    tag: PI_NATIVE_WS_METHODS.share,
  }),
} as const;
