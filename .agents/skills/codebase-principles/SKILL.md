---
name: codebase-principles
description: Implement or review Studio VKong integration in this Unsloth fork while preserving local training, upstream compatibility, optional dependencies, and clear execution ownership.
---

# Codebase principles — Unsloth + VKong fork

Read `AGENTS.md` and `vkong/ENGINEERING_PRINCIPLES.md`; consult the
relevant part of `vkong/REMOTE_TRAINING.md` for user-facing behavior.
Trace both local and remote paths for a changed training request.

Keep VKong integration behind a backend executor boundary. Do not import the
optional bridge on the ordinary local path or move VKong subprocess calls into
the worker, trainers, callbacks, or frontend. Preserve upstream package/import
names and existing local APIs. Validate remote-safe config before submission;
never ship tokens or machine-local cache paths. Treat remote identity, event
reconnection, output publication, and cancellation as explicit states.

Add focused tests for changed mapping and failure behavior, plus a local-path
non-regression check for route changes. Run the relevant Studio tests when
available; report unrun full-suite, GPU, image, and live-CLI checks honestly.
Keep unrelated upstream files untouched and document any deliberate fork drift.
