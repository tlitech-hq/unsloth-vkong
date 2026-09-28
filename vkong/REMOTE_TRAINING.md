# VKong remote training integration plan

Status: backend executor seam implemented; route, persistence, event projection,
and UI selection remain pending. The live path is still blocked on VKong's
machine-readable CLI contract.

Implemented in the fork:

- `unsloth[vkong]` optional dependency pointing at the TLI bridge repository;
- lazy `VKongTrainingExecutor`, so local installs do not require the bridge;
- translation from Studio worker config to `BundleRequest` without credentials
  or machine-local cache references;
- prepare/submit/reconcile/follow/cancel delegation to `VKongBridge`;
- catalog selection through `UNSLOTH_VKONG_STUDIO_BUILD_ID`, with explicit
  `UNSLOTH_VKONG_RUNNER_IMAGE` retained for development;
- explicit server/workspace binding through `UNSLOTH_VKONG_SERVER_URL` and
  `UNSLOTH_VKONG_WORKSPACE_ID` before the default bridge can submit;
- content-checked bundle retry and stable idempotency binding in the bridge;
- fake-boundary unit tests and a real cross-repository bridge contract test.

## 1. Product outcome

Keep Unsloth Studio on the user's machine for configuration, local inference,
history, and model use. Let the user select VKong for a training run that needs
faster compute.

The MVP requires the VKong CLI to be installed and logged in. All normal
training actions still happen inside Studio; the user does not write
`vkong.yaml` or operate instance IDs manually.

This is a proof-of-concept fork, not an official Unsloth release. Keep the
existing distribution name, Python imports, and command unchanged to minimize
fork drift:

```text
distribution: unsloth
Python import: import unsloth
CLI:           unsloth studio
```

Only the GitHub repository and installation instructions distinguish the fork.
Later, a shared VKong SDK may replace the separate CLI requirement without
changing the Studio execution abstraction.

## 2. POC repository and installation

Use a clearly named repository such as:

```text
https://github.com/tlitech-hq/unsloth-vkong
```

Do not publish the fork under `unsloth` or another name on PyPI during the POC.
Install it directly from Git in a dedicated virtual environment so its files do
not collide with an official Unsloth installation.

macOS/Linux:

```bash
python -m venv .venv-unsloth-vkong
source .venv-unsloth-vkong/bin/activate
python -m pip install \
  "unsloth[vkong] @ git+https://github.com/tlitech-hq/unsloth-vkong.git@vkong-poc-v0.1.0"
unsloth studio
```

Windows PowerShell:

```powershell
python -m venv .venv-unsloth-vkong
.venv-unsloth-vkong\Scripts\Activate.ps1
python -m pip install `
  "unsloth[vkong] @ git+https://github.com/tlitech-hq/unsloth-vkong.git@vkong-poc-v0.1.0"
unsloth studio
```

The fork adds an optional dependency group:

```toml
[project.optional-dependencies]
vkong = [
    # Development only. Replace main with an immutable bridge tag for testers.
    "vkong-connect @ git+https://github.com/tlitech-hq/vkong-connect.git@main",
]
```

This lets the single fork install command pull the matching bridge revision.
The VKong CLI binary remains a separate prerequisite in the MVP and is checked
on first use.

Use `@vkong-poc` while developing. Give testers immutable tags such as
`@vkong-poc-v0.1.0` or an exact commit. A tag records a compatible set of:

- Unsloth fork revision;
- `vkong-connect` revision;
- runner image digest;
- minimum VKong CLI JSON schema.

The fork README begins with an explicit notice:

```text
Unsloth + VKong proof of concept

This is an experimental fork of Unsloth maintained by TLI Tech to test remote
training on VKong. It is not an official Unsloth release.

Upstream: https://github.com/unslothai/unsloth
```

Installation documentation must always show the complete TLI Git URL. Never use
`pip install unsloth` as an instruction for this POC. Users can verify the
installed origin with `python -m pip freeze`.

## 3. User experience

### First use

The training configuration page adds an execution section:

```text
Training location

(*) This device
( ) VKong
```

Selecting VKong runs lightweight readiness checks:

1. `vkong version --json`
2. `vkong whoami --json`
3. adapter/runner compatibility

The UI shows one of:

- Ready, with account and workspace;
- Install VKong, linking to <https://vkong.tli-tech.com/download>;
- Connect VKong, with the `vkong login` flow;
- Upgrade VKong, when the machine-readable contract is too old.

Studio must not read the CLI token file directly. VKong owns login and
workspace selection. The VKong browser and CLI sessions are separate.

### Configure remote compute

When VKong is selected, show only the controls relevant to user intent:

```text
GPU             Auto | explicit model
GPU count       1
Max price/hour  $2.00
Verified hosts  Yes
Auto-stop       Always on
Output          Private Hugging Face repository
```

Advanced CPU, RAM, disk, bandwidth, and image settings remain behind an
advanced section or adapter policy. Defaults come from the adapter estimate,
not from the frontend.

Before Start, display that:

- VKong will create a billable rental;
- the approved maximum hourly price is not a total-run budget;
- the rental is configured to stop when the task exits;
- failure to publish output makes the run fail;
- cancelling may lose work after the last published checkpoint.

### Running

The existing live training page remains the primary UI:

- phase and status message;
- step, epoch, loss, learning rate, gradient norm, ETA, and charts;
- VKong App/Run identifiers in a details panel;
- selected GPU and actual hourly rate when available;
- link to the VKong App dashboard;
- latest durable checkpoint;
- explicit `Cancel VKong run` action.

Closing Studio does not stop the detached task. On restart, Studio reconciles
the persisted remote identity and resumes following events.

### Completion

Phase one publishes the result to a private Hugging Face repository because
VKong does not yet provide task artifact download. The completed view offers:

- `Load for inference`;
- `Download to this device`;
- `Open on Hugging Face`;
- `Open VKong run`.

The remote machine path is never shown as a local `output_dir`.

## 4. Architecture seam

The current backend combines orchestration with a local
`multiprocessing.Process`. Introduce an execution boundary while preserving the
existing route and frontend contracts.

```python
class TrainingExecutor(Protocol):
    def start(self, request: PreparedTrainingRequest) -> StartResult: ...
    def get_status(self, job_id: str) -> ExecutorStatus: ...
    def stream_events(self, job_id: str, after: int | None) -> EventStream: ...
    def stop(self, job_id: str, save: bool) -> StopResult: ...
    def reconcile(self, job_id: str) -> ReconcileResult: ...
    def get_artifacts(self, job_id: str) -> list[ArtifactRef]: ...
```

Implementations:

- `LocalProcessExecutor` delegates to the current `TrainingBackend` and must be
  behaviorally equivalent to today's local path.
- `VKongTrainingExecutor` calls the thin `vkong-connect` client, persists remote
  identity, follows structured logs, and maps bridge events into current
  training state/history.

Executor selection happens after request/model/dataset/security validation but
before local GPU eviction, local hardware admission, multiprocessing queues, or
worker spawn.

Do not add VKong calls to `core/training/worker.py`, trainers, callbacks, or
frontend components. The same worker remains usable locally and by the remote
runner.

## 5. API model changes

Add optional execution fields to `TrainingStartRequest`:

```json
{
  "execution_target": "local",
  "vkong": null
}
```

Remote example:

```json
{
  "execution_target": "vkong",
  "vkong": {
    "gpu": "Any",
    "num_gpus": 1,
    "max_dph": 2.0,
    "verified_only": true,
    "output": {
      "kind": "huggingface",
      "repo_id": "user/my-adapter",
      "private": true
    }
  }
}
```

Rules:

- default is `local` for backward compatibility;
- `vkong` is forbidden or ignored when target is local;
- tokens are never fields in the persisted VKong config;
- server validation caps numeric values and rejects unsupported combinations;
- remote execution initially supports a declared subset of training modes.

Extend status/history responses additively:

```json
{
  "execution_target": "vkong",
  "remote": {
    "app_id": "app_123",
    "run_id": "run_123",
    "instance_id": "vk_123",
    "app_state": "running",
    "gpu": "RTX 4090",
    "hourly_price": 1.2,
    "dashboard_url": "https://vkong.tli-tech.com/app/...",
    "latest_event_seq": 42
  },
  "artifacts": [
    {
      "kind": "lora-adapter",
      "uri": "hf://user/my-adapter@commit",
      "materialization": "remote"
    }
  ]
}
```

Existing clients can ignore these fields.

## 6. Backend flow

### Start

1. Validate the existing `TrainingStartRequest` and security/consent rules.
2. Reserve the existing `start_request_id` before any billable operation.
3. Select `VKongTrainingExecutor`.
4. Convert local inputs to portable references or eligible staged files.
5. Ask the bridge to validate and compile an isolated task bundle.
6. Run VKong local preflight/validation.
7. Start detached with auto-stop through machine-readable CLI output.
8. Persist remote App/Run identity before returning accepted status.
9. Start the reconnectable event follower.

An ambiguous CLI response is reconciled by idempotency key/App identity. It
must not trigger a second `vkong run` automatically.

### Progress

The executor consumes canonical bridge event lines and calls the same state and
database update logic currently fed by multiprocessing events:

```text
bridge phase     -> TrainingStatus.phase/message
bridge metric    -> loss/lr/step histories
bridge warning   -> warnings
bridge checkpoint-> latest remote checkpoint
bridge artifact  -> run artifact record
bridge terminal  -> completed/error/cancelled finalization
```

Event sequence numbers are persisted. Replayed lines after reconnect are
deduplicated.

Infrastructure metrics remain on VKong and are not mixed with training metrics.

### Reconciliation

At backend startup and before returning status for a remote active run:

1. query VKong App and Run state;
2. compare the persisted last event sequence;
3. resume the log/event follower;
4. apply missed terminal state if the follower was offline;
5. surface inconsistent states instead of silently starting another run.

### Stop

Phase one cannot promise current Unsloth `Stop and Save` semantics remotely.
The UI therefore distinguishes:

- local `Stop and Save`;
- remote `Cancel VKong run`, which preserves only already published
  checkpoints.

Cancellation calls `vkong app stop --yes --json` and remains in a stopping
state until VKong reports `stopped`. Only then may the UI say billing ended.

When VKong adds a safe task-control signal, remote Stop and Save can be enabled
without changing the executor interface.

## 7. Input policy

Supported initially:

- HF model pinned to a revision;
- HF dataset pinned to a revision;
- small local JSON, JSONL, or CSV files within VKong sync limits;
- published remote checkpoint URI.

Rejected initially:

- local model directories;
- local checkpoints;
- files over 50 MiB or bundles over 500 MiB;
- paths outside the approved data roots;
- S3/local formats not implemented by the adapter;
- formats VKong source sync excludes.

Studio performs this check before any rental starts and explains the supported
alternative: publish the model/dataset to Hugging Face or wait for native VKong
artifact upload.

## 8. Secrets

Add VKong integration settings containing secret bundle names, not values:

```text
Hugging Face secret bundle: huggingface
Weights & Biases secret bundle: wandb
```

The generated `vkong.yaml` references these names. VKong injects their current
versions into the new Run. Studio must never copy its local `hf_token` or
`wandb_token` into a bundle, command line, event, log, or history row.

The readiness UI should verify required secret names through a supported VKong
capability when available. Until then, missing secrets fail during runner
preflight with a stable actionable error.

## 9. Persistence changes

Keep Unsloth SQLite as a local projection for UX, not a competing source of
truth for VKong lifecycle.

Add nullable fields or a related table for:

- execution target;
- bridge job ID/version;
- VKong App, Run, and instance IDs;
- last processed event sequence;
- App state and last reconciliation time;
- selected GPU and hourly rate;
- dashboard URL;
- latest checkpoint URI;
- final artifact URI/kind/materialization state.

Never persist CLI tokens, HF/W&B tokens, generated secret values, or a remote
machine path as `output_dir`.

For local runs all new columns remain null/default and existing history behavior
is unchanged.

## 10. Suggested code changes

```text
studio/backend/core/training/executors/
  __init__.py
  base.py
  local.py
  vkong.py

studio/backend/integrations/vkong/
  client.py               # bridge client facade
  readiness.py            # version/whoami/capabilities
  event_stream.py         # JSONL parsing and reconnect
  models.py               # typed external responses

studio/backend/models/training.py
  # execution request/status models

studio/backend/core/training/training.py
  # extract reusable state/event projection; retain local orchestration

studio/backend/routes/training.py
  # executor selection and remote-specific validation

studio/backend/storage/studio_db.py
  # remote identity/artifact projection and migrations

studio/frontend/src/features/training/
  # API types, target selection, readiness, remote status

studio/frontend/src/features/studio/
  # execution and compute controls, completion actions
```

Prefer extracting event projection from the existing `_handle_event` path so
both executors produce identical charts and run finalization. Do not duplicate
the local training state machine in a second route module.

## 11. Compatibility and rollout

The VKong adapter advertises a compatibility tuple:

```text
Studio version
Unsloth worker version/commit
bridge adapter schema
runner image digest
minimum VKong CLI JSON schema
```

Studio blocks a remote start when the tuple is unsupported and gives a concrete
upgrade action. Local training remains available.

Gate the initial integration behind a feature flag until the following are
stable:

- machine-readable CLI contract;
- remote runner image promotion;
- reconnect and idempotency behavior;
- final output publication;
- cancellation and auto-stop verification.

## 12. Testing plan

### Unit

- local/VKong executor selection;
- request validation and secret redaction;
- bridge-to-Unsloth event mapping;
- duplicate event suppression;
- status and terminal-state mapping;
- sync-limit and unsupported-input errors;
- CLI error-code mapping;
- history serialization without credentials.

### Contract

- fixture every supported VKong CLI JSON response;
- reject unknown breaking schema versions;
- adapter/runner compatibility matrix;
- generated `vkong.yaml` validation;
- canonical event schema and monotonic sequence behavior.

### Integration with fake VKong CLI

- successful detached start;
- start response lost, then reconciled;
- no capacity and insufficient credit;
- event-stream disconnect/reconnect;
- Studio restart during training;
- duplicate/replayed metrics;
- final publication failure;
- cancel followed by delayed `stopped` state;
- auto-stop success and failure.

### End to end

- fine-tune a small model from an HF dataset;
- close Studio after start;
- reopen and recover the active run;
- finish and verify the private HF artifact;
- load it into local inference;
- verify the App reaches `stopped` and no rental remains active.

## 13. Delivery phases

### Phase A: backend seam only

- Add `TrainingExecutor`.
- Move current behavior behind `LocalProcessExecutor`.
- Run existing training tests unchanged.

Exit: no visible product change and no local regression.

### Phase B: hidden VKong vertical slice

- Add readiness checks and `VKongTrainingExecutor` behind a flag.
- Support one LoRA/QLoRA path with HF-hosted inputs.
- Follow structured events and publish final output to private HF.
- Add the `vkong` extra and validate installation from the tagged Git fork in a
  clean virtual environment.

Exit: internal end-to-end run succeeds and auto-stops.

### Phase C: user-facing beta

- Add execution target, compute limits, disclosure/confirmation, and remote
  details.
- Persist and reconcile active remote runs.
- Add completion actions and remote cancellation warning.

Exit: a user completes the whole flow without editing `vkong.yaml` or using an
instance ID.

### Phase D: artifacts and safe stop

- Adopt native VKong artifacts when available.
- Materialize remote outputs into normal Unsloth model inventory.
- Enable remote Stop and Save only after a confirmed safe control channel.

## 14. Acceptance criteria

- Installing no VKong component leaves local Unsloth unchanged.
- Remote training requires no hand-written `vkong.yaml`.
- Studio never parses human CLI output.
- A lost start response cannot create a duplicate rental.
- A detached job survives Studio shutdown.
- Studio restart reconnects without losing or duplicating metrics.
- Success implies a durable, loadable output outside the rented filesystem.
- Cancellation language matches actual checkpoint guarantees.
- Auto-stop is configured for every remote training task.
- The UI confirms VKong `stopped` before saying billing ended.
- No credential is present in request history, generated files, logs, or argv.
- Existing local start, progress, stop/save, resume, export, and history tests
  continue to pass.
- The fork is not published to PyPI and every tester install instruction names
  the TLI GitHub repository explicitly.
- Official Unsloth and the POC are tested in separate virtual environments; the
  installer never silently replaces an existing environment's distribution.
