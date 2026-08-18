/**
 * Building train / craft queue — units, items, vehicles.
 */
import type { ProductionJob } from "./types";
import {
  enqueueItemJob,
  enqueueUnitJob,
  enqueueVehicleJob,
  tickProduction,
  getRecipe,
} from "./production";
import { getUnit } from "./units";
import { persistProductionJobsToApi } from "./claimStore";

let jobs: ProductionJob[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function subscribeTrain(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getJobs(): ProductionJob[] {
  return jobs.slice();
}

export function getJobsForBuilding(buildingInstanceId: string): ProductionJob[] {
  return jobs.filter((j) => j.buildingInstanceId === buildingInstanceId);
}

export function queueTrainUnit(
  buildingInstanceId: string,
  unitId: string,
  nowMs = Date.now(),
): ProductionJob | null {
  const job = enqueueUnitJob(buildingInstanceId, unitId, nowMs);
  if (!job) return null;
  jobs = [...jobs, job];
  notify();
  return job;
}

export function queueCraftItem(
  buildingInstanceId: string,
  recipeId: string,
  nowMs = Date.now(),
  assignee?: string,
): ProductionJob | null {
  const job = enqueueItemJob(buildingInstanceId, recipeId, nowMs, assignee);
  if (!job) return null;
  jobs = [...jobs, job];
  notify();
  return job;
}

export function queueVehicle(
  buildingInstanceId: string,
  vehicleId: string,
  nowMs = Date.now(),
): ProductionJob {
  const job = enqueueVehicleJob(buildingInstanceId, vehicleId, nowMs);
  jobs = [...jobs, job];
  notify();
  return job;
}

export function tickTrainQueue(nowMs = Date.now()): ProductionJob[] {
  const { running, completed } = tickProduction(jobs, nowMs);
  jobs = running;
  if (completed.length) notify();
  return completed;
}

export function describeJob(job: ProductionJob): string {
  if (job.kind === "unit") {
    return getUnit(job.recipeOrUnitId)?.name ?? job.recipeOrUnitId;
  }
  if (job.kind === "item") {
    return getRecipe(job.recipeOrUnitId)?.label ?? job.recipeOrUnitId;
  }
  return job.recipeOrUnitId;
}

export function loadJobsFromStorage(): void {
  try {
    const raw = localStorage.getItem("grudge_camp_jobs_v1");
    if (!raw) return;
    jobs = JSON.parse(raw) as ProductionJob[];
    notify();
  } catch {
    /* */
  }
}

export async function flushJobs(token: string | null): Promise<void> {
  await persistProductionJobsToApi(jobs, token);
}
