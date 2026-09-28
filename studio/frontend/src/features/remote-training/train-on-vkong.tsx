// SPDX-License-Identifier: AGPL-3.0-only
// VKong fork: "Train on VKong" button, confirmation dialog, and job status list.
// The training configuration is the same payload Studio uses for local training.

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTrainingConfigStore } from "@/features/training";
// eslint-disable-next-line no-restricted-imports
import { buildTrainingStartPayload } from "@/features/training/api/mappers";
import { useCallback, useEffect, useState } from "react";
import {
  type RemoteTrainingJob,
  type RemoteTrainingReadiness,
  TERMINAL_STATES,
  getRemoteTrainingReadiness,
  listRemoteTrainingJobs,
  refreshRemoteTrainingJob,
  startRemoteTrainingJob,
  stopRemoteTrainingJob,
} from "./api";

const OUTPUT_REPO_KEY = "vkong-connect.output-repo";
const GPU_KEY = "vkong-connect.gpu";
const MAX_DPH_KEY = "vkong-connect.max-dph";
const POLL_MS = 10_000;
const OUTPUT_REPO_RE = /^[\w.-]+\/[\w.-]+$/;

function readSetting(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeSetting(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Settings are a convenience only.
  }
}

const STATE_LABEL: Record<RemoteTrainingJob["state"], string> = {
  preparing: "Preparing",
  starting: "Starting GPU",
  running: "Running",
  stopping: "Stopping",
  finished: "Finished",
  failed: "Failed",
  stopped: "Stopped",
};

function stateVariant(state: RemoteTrainingJob["state"]) {
  if (state === "failed") {
    return "destructive" as const;
  }
  if (state === "finished") {
    return "default" as const;
  }
  return TERMINAL_STATES.has(state)
    ? ("outline" as const)
    : ("secondary" as const);
}

export function TrainOnVKong({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [readiness, setReadiness] = useState<RemoteTrainingReadiness | null>(
    null,
  );
  const [jobs, setJobs] = useState<RemoteTrainingJob[]>([]);
  const [outputRepo, setOutputRepo] = useState(() =>
    readSetting(OUTPUT_REPO_KEY, ""),
  );
  const [gpu, setGpu] = useState(() => readSetting(GPU_KEY, "Any"));
  const [maxDph, setMaxDph] = useState(() => readSetting(MAX_DPH_KEY, "1.0"));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await listRemoteTrainingJobs());
    } catch {
      // The list is informational; the next poll retries.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    listRemoteTrainingJobs()
      .then((loaded) => {
        if (!cancelled) {
          setJobs(loaded);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const activeIds = jobs
    .filter((job) => !TERMINAL_STATES.has(job.state))
    .map((job) => job.job_id)
    .join(",");
  useEffect(() => {
    if (!activeIds) {
      return;
    }
    const timer = window.setInterval(() => {
      void Promise.all(
        activeIds
          .split(",")
          .map((jobId) => refreshRemoteTrainingJob(jobId).catch(() => null)),
      ).then(() => loadJobs());
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [activeIds, loadJobs]);

  const openDialog = async () => {
    setError(null);
    setReadiness(null);
    setOpen(true);
    try {
      setReadiness(await getRemoteTrainingReadiness());
    } catch (exc) {
      setReadiness({
        installed: true,
        ready: false,
        message: String((exc as Error).message),
      });
    }
  };

  const start = async () => {
    setError(null);
    const price = Number(maxDph);
    if (!OUTPUT_REPO_RE.test(outputRepo.trim())) {
      setError("Output repository must look like username/repo-name.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Max price per hour must be a positive number.");
      return;
    }
    setSubmitting(true);
    try {
      // Never send the local Hugging Face token: the GPU host reads HF_TOKEN from the
      // VKong workspace secret named "huggingface".
      const training = buildTrainingStartPayload(
        useTrainingConfigStore.getState(),
        null,
      );
      await startRemoteTrainingJob({
        training,
        output_repo_id: outputRepo.trim(),
        compute: { gpu: gpu.trim() || "Any", max_dph: price, num_gpus: 1 },
      });
      writeSetting(OUTPUT_REPO_KEY, outputRepo.trim());
      writeSetting(GPU_KEY, gpu.trim() || "Any");
      writeSetting(MAX_DPH_KEY, String(price));
      setOpen(false);
      await loadJobs();
    } catch (exc) {
      setError((exc as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const stop = async (jobId: string) => {
    try {
      await stopRemoteTrainingJob(jobId);
    } finally {
      await loadJobs();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="h-10 w-full justify-center rounded-xl"
        disabled={disabled}
        onClick={() => {
          void openDialog();
        }}
      >
        Train on VKong
      </Button>

      {jobs.slice(0, 5).map((job) => (
        <div
          key={job.job_id}
          className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 text-ui-11p5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium">
              {job.model_name ?? job.job_id}
            </span>
            <Badge variant={stateVariant(job.state)}>
              {STATE_LABEL[job.state]}
            </Badge>
          </div>
          <p className="break-words text-muted-foreground">{job.message}</p>
          <div className="flex items-center justify-between gap-2 text-muted-foreground">
            <span>
              {job.gpu ?? job.compute.gpu} · max ${job.compute.max_dph}/h
            </span>
            {job.state === "finished" ? (
              <a
                className="text-primary underline-offset-4 hover:underline"
                href={job.output_url}
                target="_blank"
                rel="noreferrer"
              >
                Open output
              </a>
            ) : !TERMINAL_STATES.has(job.state) && job.state !== "stopping" ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => void stop(job.job_id)}
              >
                Stop
              </Button>
            ) : null}
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Train on VKong</DialogTitle>
            <DialogDescription>
              Runs the current training configuration on a rented VKong GPU. The
              GPU is released automatically when training ends, and the result
              is pushed to a private Hugging Face repository.
            </DialogDescription>
          </DialogHeader>

          {readiness === null ? (
            <p className="text-muted-foreground">Checking VKong…</p>
          ) : readiness.ready ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground">
                Signed in to VKong as <strong>{readiness.user}</strong>{" "}
                (workspace {readiness.workspace_id}). Progress charts are not
                available yet; this panel shows the job state.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vkong-output-repo">
                  Output repository on Hugging Face
                </Label>
                <Input
                  id="vkong-output-repo"
                  placeholder="username/my-finetune"
                  value={outputRepo}
                  onChange={(event) => setOutputRepo(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vkong-gpu">GPU</Label>
                  <Input
                    id="vkong-gpu"
                    placeholder="Any, RTX 4090, A100…"
                    value={gpu}
                    onChange={(event) => setGpu(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vkong-max-dph">
                    Max price per hour (USD)
                  </Label>
                  <Input
                    id="vkong-max-dph"
                    inputMode="decimal"
                    value={maxDph}
                    onChange={(event) => setMaxDph(event.target.value)}
                  />
                </div>
              </div>
              <p className="text-muted-foreground">
                Requires a VKong secret named <code>huggingface</code>{" "}
                containing <code>HF_TOKEN</code>.
              </p>
            </div>
          ) : (
            <p role="alert" className="text-destructive">
              {readiness.message ?? "VKong is not ready."}
            </p>
          )}

          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!readiness?.ready || submitting}
              onClick={() => void start()}
            >
              {submitting ? "Starting…" : "Start on VKong"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
