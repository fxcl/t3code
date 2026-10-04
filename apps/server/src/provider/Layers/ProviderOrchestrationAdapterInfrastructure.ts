import * as Layer from "effect/Layer";

import * as IdAllocator from "../../orchestration-v2/IdAllocator.ts";
import * as ProviderContinuationRequests from "../../orchestration-v2/ProviderContinuationRequests.ts";

export type ProviderOrchestrationAdapterInfrastructure = IdAllocator.IdAllocatorV2;

/**
 * Infrastructure shared by the V2 adapters materialized inside provider
 * instances. `providerContinuationRequestsLayer` must be the same layer
 * reference the orchestration runtime provides to its continuation worker so
 * Effect layer memoization yields one shared queue.
 *
 * The per-adapter SDK runners (Claude agent SDK, Codex app-server, Cursor
 * agent SDK) were removed with their adapters; the Pi adapter spawns its
 * runtime directly and needs no extra infrastructure here.
 */
export const ProviderOrchestrationAdapterInfrastructureLive = Layer.mergeAll(
  IdAllocator.layer,
  ProviderContinuationRequests.layer,
);
