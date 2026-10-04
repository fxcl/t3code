import { assert, describe, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  NodeId,
  ProviderInstanceId,
  ProviderSessionId,
  RunAttemptId,
  RunId,
  ThreadId,
  type ChatAttachment,
  type ModelSelection,
  type OrchestrationV2AppThread,
  type OrchestrationV2ProviderThread,
} from "@t3tools/contracts";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { ChildProcessSpawner } from "effect/unstable/process";

import * as ServerConfig from "../../config.ts";
import * as IdAllocator from "../IdAllocator.ts";
import {
  ProviderAdapterV2RuntimePolicy,
  type ProviderAdapterV2Event,
  type ProviderAdapterV2SessionRuntime,
} from "../ProviderAdapter.ts";
import { makePiAdapterV2 } from "./PiAdapterV2.ts";
import {
  makePiRpcConnection,
  piRecordField,
  type PiRpcConnection,
  type PiRpcRecord,
} from "./PiRpc.ts";

/**
 * Protocol coverage for `PiRpc.ts` driven by the executable fake Pi fixture —
 * a plain Node script, so these tests run without a real Pi install. The live
 * adapter turn at the bottom is gated behind `T3_TEST_PI_LIVE=1` because it
 * exercises the full spawn → handshake → prompt path end to end.
 *
 * Timing rules: the `it.effect` tests end by terminating the fixture and
 * advancing the TestClock past the termination grace, so the connection's
 * finalizer never waits on a sleep the clock would otherwise never elapse.
 * The two tests that need a request to time out run on `it.live` with a short
 * real timeout instead — forking a sleeper and advancing the TestClock races
 * the sleeper's registration, and no test asserts on wall-clock sleeps.
 */
const FIXTURE_PATH = `${import.meta.dirname}/fixtures/fake-pi`;

const PI_INSTANCE_ID = ProviderInstanceId.make("pi");
const THREAD_ID = ThreadId.make("thread-pi-protocol");
const SESSION_ID = ProviderSessionId.make("provider-session-pi-protocol");

const runtimePolicy = ProviderAdapterV2RuntimePolicy.make({
  runtimeMode: "full-access",
  interactionMode: "default",
  cwd: null,
});

const modelSelection = (model: string): ModelSelection => ({
  instanceId: PI_INSTANCE_ID,
  model,
});

const serverConfigLayer = ServerConfig.layerTest(process.cwd(), {
  prefix: "t3-pi-rpc-protocol-",
}).pipe(Layer.provide(NodeServices.layer));

const testLayer = Layer.mergeAll(NodeServices.layer, IdAllocator.layer, serverConfigLayer);

const connectFixture = Effect.fnUntraced(function* (options: {
  readonly args?: ReadonlyArray<string>;
  readonly env?: NodeJS.ProcessEnv;
}) {
  const fileSystem = yield* FileSystem.FileSystem;
  // The exit marker installs the fixture's SIGTERM handler, so terminate
  // deterministically produces a clean exit code 0 instead of a signal death.
  const markerDir = yield* fileSystem.makeTempDirectory({ prefix: "t3-fake-pi-" });
  return yield* makePiRpcConnection({
    command: FIXTURE_PATH,
    args: options.args ?? ["--mode", "rpc"],
    cwd: undefined,
    env: {
      ...process.env,
      FAKE_PI_EXIT_MARKER: `${markerDir}/exit`,
      ...options.env,
    },
  });
});

/**
 * Deterministic teardown shared by all fixture tests: SIGTERM the fixture and
 * wait for its real exit. `it.effect` callers follow with a TestClock adjust
 * (see `stopFixture`); `it.live` callers need nothing more.
 */
const terminateFixture = Effect.fnUntraced(function* (connection: PiRpcConnection) {
  yield* Effect.forkScoped(connection.terminate);
  const exitCode = yield* connection.exited;
  assert.equal(exitCode, 0);
});

/**
 * `it.effect` teardown: after the real exit above, let the connection's
 * termination grace elapse on the TestClock so closing the scope never blocks
 * on a sleep the clock will not advance.
 */
const stopFixture = Effect.fnUntraced(function* (connection: PiRpcConnection) {
  yield* terminateFixture(connection);
  yield* TestClock.adjust(Duration.seconds(2));
});

describe("PiRpc protocol (fake-pi fixture)", () => {
  it.effect("correlates concurrent responses and keeps non-responses off the request path", () =>
    Effect.gen(function* () {
      const connection = yield* connectFixture({});

      // Two requests in flight at once; responses must land on their own
      // callers by id, never swapped.
      const stateFiber = yield* Effect.forkScoped(connection.request({ type: "get_state" }));
      const entriesData = yield* connection.request({ type: "get_entries" });
      const stateData = yield* Fiber.join(stateFiber);
      assert.isDefined(piRecordField(stateData, "sessionFile"));
      assert.isArray(piRecordField(entriesData, "entries"));

      // `abort` answers the request and also emits a session event: the
      // response is consumed by the caller, the event by the queue.
      yield* connection.request({ type: "abort" });
      const event = yield* Queue.take(connection.events);
      assert.equal(event["type"], "agent_settled");
      const rest = yield* Queue.poll(connection.events);
      assert.isTrue(Option.isNone(rest));
      yield* stopFixture(connection);
    }).pipe(Effect.scoped, Effect.provide(testLayer)),
  );

  it.effect("rejects a failed response as a typed PiRpcError with the remote detail", () =>
    Effect.gen(function* () {
      const connection = yield* connectFixture({});
      // `Effect.asVoid` before the flip: the flip moves the success channel
      // into the error channel, and `request` succeeds with `unknown`.
      const error = yield* Effect.flip(
        connection.request({ type: "navigate_tree", targetId: "stale" }).pipe(Effect.asVoid),
      );
      if (error._tag !== "PiRpcError") return assert.fail(`Expected PiRpcError, got ${error._tag}`);
      assert.equal(error.operation, "navigate_tree");
      assert.include(error.detail ?? "", "Entry not found: stale");
      yield* stopFixture(connection);
    }).pipe(Effect.scoped, Effect.provide(testLayer)),
  );

  it.live("times out a request the fixture never answers", () =>
    Effect.gen(function* () {
      const connection = yield* connectFixture({
        args: ["--mode", "rpc", "--session-id", "hang"],
        env: { FAKE_PI_HANG_SESSION_ID: "hang" },
      });
      // A short real timeout: the fixture never answers, so this fails with
      // the typed timeout instead of waiting out the 30s default.
      const error = yield* Effect.flip(
        connection.request({ type: "get_capabilities" }, 150).pipe(Effect.asVoid),
      );
      if (error._tag !== "PiRpcTimeoutError")
        return assert.fail(`Expected PiRpcTimeoutError, got ${error._tag}`);
      assert.equal(error.operation, "get_capabilities");
      assert.equal(error.timeoutMs, 150);
      yield* terminateFixture(connection);
    }).pipe(Effect.scoped, Effect.provide(testLayer)),
  );
});

describe("PiRpc termination (fake-pi fixture)", () => {
  it.live("fails pending requests, drains the transport and exits cleanly on terminate", () =>
    Effect.gen(function* () {
      const connection = yield* connectFixture({
        args: ["--mode", "rpc", "--session-id", "hang"],
        env: { FAKE_PI_HANG_SESSION_ID: "hang" },
      });
      // Round-trip once before terminating: a SIGTERM that lands before node
      // has installed the fixture's handler kills it with the default
      // disposition (signal death), which would mask the clean-exit assertion.
      const ready = yield* connection.request({ type: "get_state" });
      assert.isDefined(piRecordField(ready, "sessionFile"));
      const pending = yield* Effect.forkScoped(
        connection.request({ type: "get_capabilities" }, 60_000),
      );

      yield* Effect.forkScoped(connection.terminate);
      // A request registered before termination is failed by the transport
      // instead of waiting out its timeout for a reply that never comes.
      const error = yield* Effect.flip(Fiber.join(pending).pipe(Effect.asVoid));
      if (error._tag !== "PiRpcError") return assert.fail(`Expected PiRpcError, got ${error._tag}`);
      assert.equal(error.operation, "terminate");
      assert.equal(error.detail, "pi process was stopped");
      // Later requests fail immediately instead of buffering into a dead
      // transport.
      const later = yield* Effect.flip(
        connection.request({ type: "get_state" }).pipe(Effect.asVoid),
      );
      if (later._tag !== "PiRpcError") return assert.fail(`Expected PiRpcError, got ${later._tag}`);
      assert.equal(later.operation, "terminate");

      yield* terminateFixture(connection);
    }).pipe(Effect.scoped, Effect.provide(testLayer)),
  );
});

describe("PiAdapterV2 live fixture turn", () => {
  const makeAppThread = Effect.fnUntraced(function* (threadId: ThreadId) {
    const now = yield* DateTime.now;
    return {
      createdBy: "user",
      creationSource: "web",
      id: threadId,
      projectId: "project:fixture:pi" as OrchestrationV2AppThread["projectId"],
      title: "Pi live fixture thread",
      providerInstanceId: PI_INSTANCE_ID,
      modelSelection: modelSelection("default"),
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      activeProviderThreadId: null,
      lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: threadId },
      forkedFrom: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      settledOverride: null,
      settledAt: null,
      lastVisitedAt: null,
      deletedAt: null,
    } satisfies OrchestrationV2AppThread;
  });
  const startTurn = Effect.fnUntraced(function* (
    runtime: ProviderAdapterV2SessionRuntime,
    providerThread: OrchestrationV2ProviderThread,
    threadId: ThreadId,
  ) {
    const appThread = yield* makeAppThread(threadId);
    const runId = RunId.make(`run:${threadId}:1`);
    yield* runtime.startTurn({
      appThread,
      threadId,
      runId,
      runOrdinal: 1,
      providerTurnOrdinal: 1,
      attemptId: RunAttemptId.make(`run-attempt:${runId}:1`),
      rootNodeId: NodeId.make(`node:${runId}:root`),
      providerThread,
      message: {
        messageId: `message:${threadId}:1` as never,
        text: "Hello pi",
        attachments: [] as ReadonlyArray<ChatAttachment>,
        createdBy: "user",
        creationSource: "web",
      },
      modelSelection: modelSelection("default"),
      runtimePolicy,
    });
  });

  // `it.live`, not `it.effect`: the turn flow itself is event-driven, but the
  // connection's scope finalizer terminates the fixture with a real grace
  // sleep, and a TestClock would never advance it.
  it.live.skipIf(process.env.T3_TEST_PI_LIVE !== "1")(
    "drives a full turn through the spawned fake Pi",
    () =>
      Effect.gen(function* () {
        const crypto = yield* Crypto.Crypto;
        // Unique ids per run so parallel live runs cannot collide on the
        // fixture's session state.
        const threadId = ThreadId.make(`thread-live-${yield* crypto.randomUUIDv4}`);
        const providerSessionId = ProviderSessionId.make(
          `provider-session-live-${yield* crypto.randomUUIDv4}`,
        );
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const adapter = makePiAdapterV2({
          instanceId: PI_INSTANCE_ID,
          settings: { enabled: true, binaryPath: FIXTURE_PATH, launchArgs: "", customModels: [] },
          // The child inherits exactly this environment (extendEnv is false in
          // the transport), so PATH must be present for the fixture's node
          // shebang to resolve.
          environment: { ...process.env },
          spawner,
          fileSystem: yield* FileSystem.FileSystem,
          idAllocator: yield* IdAllocator.IdAllocatorV2,
          serverConfig: yield* ServerConfig.ServerConfig,
        });

        const runtime = yield* adapter.openSession({
          threadId,
          providerSessionId,
          modelSelection: modelSelection("default"),
          runtimePolicy,
        });
        const emitted = yield* Queue.unbounded<ProviderAdapterV2Event>();
        yield* runtime.events.pipe(
          Stream.runForEach((event) => Queue.offer(emitted, event)),
          Effect.forkScoped,
        );

        const providerThread = yield* runtime.ensureThread({
          threadId,
          modelSelection: modelSelection("default"),
          runtimePolicy,
        });
        // get_state's sessionFile became the thread's native ref (after the
        // fixture rotated it for the fresh new_session).
        assert.match(providerThread.nativeThreadRef?.nativeId ?? "", /^\/fake\/\.pi\//);

        yield* startTurn(runtime, providerThread, threadId);
        const events: ProviderAdapterV2Event[] = [];
        while (true) {
          const event = yield* Queue.take(emitted);
          events.push(event);
          if (event.type === "turn.terminal") break;
        }
        const terminal = events.at(-1);
        assert.isTrue(terminal?.type === "turn.terminal" && terminal.status === "completed");
        assert.isTrue(
          events.some(
            (event) =>
              event.type === "turn_item.updated" &&
              event.turnItem.type === "assistant_message" &&
              event.turnItem.text === "OK",
          ),
        );
        assert.isTrue(
          events.some((event) => event.type === "provider_thread.updated"),
        );
      }).pipe(Effect.scoped, Effect.provide(testLayer)),
  );
});
