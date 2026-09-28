// SPDX-License-Identifier: AGPL-3.0-only
// VKong fork: client for Studio's local /api/remote-training routes. Those routes
// drive VKong only through the `vkong` CLI via vkong-connect.

import { authFetch } from "@/features/auth";
import { readFastApiError } from "@/lib/format-fastapi-error";

const BASE = "/api/remote-training";

export type RemoteTrainingReadiness = {
  installed: boolean;
  ready: boolean;
  cli_installed?: boolean;
  logged_in?: boolean;
  user?: string;
  workspace_id?: string;
  message?: string;
  progress_supported?: boolean;
  runtime?: {
    kind: string;
    unsloth_fork_commit: string;
    connect_commit: string;
  };
};

export type RemoteTrainingJobState =
  | "preparing"
  | "starting"
  | "running"
  | "stopping"
  | "finished"
  | "failed"
  | "stopped";

export type RemoteTrainingJob = {
  job_id: string;
  state: RemoteTrainingJobState;
  message: string;
  created_at: string;
  model_name?: string;
  output_repo_id: string;
  output_url: string;
  gpu?: string | null;
  compute: { gpu: string; max_dph: number; num_gpus: number };
  app_id?: string | null;
};

export const TERMINAL_STATES: ReadonlySet<RemoteTrainingJobState> = new Set([
  "finished",
  "failed",
  "stopped",
]);

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await readFastApiError(response));
  }
  return (await response.json()) as T;
}

export async function getRemoteTrainingReadiness(): Promise<RemoteTrainingReadiness> {
  const response = await authFetch(`${BASE}/readiness`);
  if (response.status === 404) {
    return {
      installed: false,
      ready: false,
      message:
        "VKong support is not installed. Run vkong/install-vkong-connect.sh from the unsloth-vkong checkout, then restart Studio.",
    };
  }
  return {
    installed: true,
    ...(await json<Omit<RemoteTrainingReadiness, "installed">>(response)),
  };
}

export async function startRemoteTrainingJob(body: {
  training: unknown;
  output_repo_id: string;
  compute: { gpu: string; max_dph: number; num_gpus: number };
}): Promise<RemoteTrainingJob> {
  return json(
    await authFetch(`${BASE}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function listRemoteTrainingJobs(): Promise<RemoteTrainingJob[]> {
  const response = await authFetch(`${BASE}/jobs`);
  if (response.status === 404) {
    return [];
  }
  return (await json<{ jobs: RemoteTrainingJob[] }>(response)).jobs;
}

export async function refreshRemoteTrainingJob(
  jobId: string,
): Promise<RemoteTrainingJob> {
  return json(await authFetch(`${BASE}/jobs/${encodeURIComponent(jobId)}`));
}

export async function stopRemoteTrainingJob(
  jobId: string,
): Promise<RemoteTrainingJob> {
  return json(
    await authFetch(`${BASE}/jobs/${encodeURIComponent(jobId)}/stop`, {
      method: "POST",
    }),
  );
}
