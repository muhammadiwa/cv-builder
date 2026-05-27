/// <reference lib="webworker" />
import * as Comlink from "comlink";
import { computeATSScore } from "./scorer";
import type { ATSScore, ScoringInput } from "./types";

/**
 * ATS Scoring Web Worker.
 *
 * Runs `computeATSScore` off the main thread so the editor stays responsive
 * during scoring computation. Exposed via comlink for typed RPC.
 *
 * IMPORTANT: This file must NOT import any Node.js modules, next/server,
 * or React — it runs in a Worker context, not the main thread.
 */
const api = {
    computeScore(input: ScoringInput): ATSScore {
        return computeATSScore(input);
    },
};

export type WorkerAPI = typeof api;

Comlink.expose(api);
