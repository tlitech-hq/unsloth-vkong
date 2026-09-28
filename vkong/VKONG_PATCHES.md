# Changes to upstream files

Everything else for VKong lives in new files (`vkong/`, `studio/frontend/src/features/remote-training/`)
or in vkong-connect. Keep this list short; each entry is a potential merge conflict.

| File | Change |
|---|---|
| `README.md` | Fork notice at the top |
| `pyproject.toml` | `vkong` optional extra |
| `studio/backend/main.py` | Mount vkong-connect's `/api/remote-training` router when installed (9 lines) |
| `studio/frontend/src/features/studio/wizard/start-training-cta.tsx` | Render `<TrainOnVKong />` under Start Training (2 lines) |

Upstream surfaces vkong-connect depends on (checked when bumping upstream):
`core.training.worker.run_training_process(*, event_queue, stop_queue, config)`,
`core.training.training._build_training_worker_config(values)`, and the frontend's
`buildTrainingStartPayload(config, hfToken)`.
