# VKong fork engineering principles

This document governs fork-specific changes to Studio. It complements upstream
[CONTRIBUTING.md](../CONTRIBUTING.md) and the proposed
[remote-training plan](REMOTE_TRAINING.md); it does not replace either.

## Product and code boundaries

Studio remains the user's training configuration and progress UI. The user
chooses local or VKong execution within Studio; they should not have to write a
`vkong.yaml` or manage rentals manually. Keep normal local training behavior
and installation intact. The VKong extra is optional; import the bridge lazily
and show actionable readiness errors when the CLI or login is missing.

The execution choice belongs after common request validation but before local
GPU admission or worker spawn. Keep training algorithms and worker events
independent of VKong. Studio owns its request, history, and UI projection;
`vkong-connect` owns translation and adapter execution; VKong owns auth, Apps,
Runs, rentals, secrets, and billing. Do not duplicate the VKong CLI or put CLI
subprocess logic in frontend components, trainers, or workers.

## User-visible and operational invariants

- Explicitly distinguish this Git-installed fork from official Unsloth in
  installation docs. Keep the existing Python package/import name for the POC.
  Use immutable fork, bridge, and runner-image refs for tester instructions;
  never imply a moving branch is reproducible.
- Show the billable hourly ceiling, auto-stop behavior, output destination,
  and cancellation/data-loss implications before remote start.
- Persist remote identity before treating a detached start as successful, and
  reconcile an ambiguous retry instead of risking a duplicate rental. Closing
  Studio must not imply that the remote task stopped.
- Never serialize tokens or machine-local caches into a remote job. Prefer
  VKong workspace secrets and explicit, supportable dataset/model sources.
- Map remote progress into existing Studio state without pretending a remote
  path is a local output. A run is complete only after durable publication.
- Keep unsupported POC paths (for example checkpoint resume or unsupported
  training types) visibly unavailable rather than silently falling back to
  local training.

## Review and verification

For changes to UX, persistence, retry, billing, or data movement, write a
small decision note covering expected behavior, failure cases, alternatives,
and verification before implementation. Prefer narrow seams and focused PRs to
fork-wide rewrites. Test local-path non-regression and VKong fake-boundary
behavior; report separately whether the installed CLI, runner image, and real
GPU path were exercised.

This reviewable-design and test-evidence approach draws on the
[Rust RFC process](https://github.com/rust-lang/rfcs),
[Kubernetes architecture proposals](https://github.com/kubernetes/community/tree/master/sig-architecture),
and [Transformers contribution guidance](https://github.com/huggingface/transformers/blob/main/CONTRIBUTING.md).
Those sources inform this fork's practice but do not make it an upstream policy.
