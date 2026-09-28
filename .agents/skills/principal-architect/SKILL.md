---
name: principal-architect
description: Design or review consequential Studio-to-VKong UX, executor, persistence, and lifecycle changes in this Unsloth fork. Use before cross-boundary decisions, not routine edits.
---

# Principal architect — Unsloth + VKong fork

Read `AGENTS.md`, `vkong/REMOTE_TRAINING.md`, and
`vkong/ENGINEERING_PRINCIPLES.md`. Inspect the relevant Studio route,
backend, frontend, and bridge contract before describing the current state.
Separate what works today from the proposed UX and external CLI blockers.

For a significant change, produce a concise design decision with the user
journey, local/remote selection point, ownership boundaries, state transitions,
cost and data implications, failure/retry/cancel behavior, compatibility with
upstream, alternatives, and a staged test plan. Keep the smallest seam that
preserves local behavior and avoids scattering VKong logic through Studio.

Do not assume official Unsloth release, bridge publication, or live VKong CLI
support. Escalate product choices that change user billing exposure, artifact
destination, or the meaning of Start/Cancel rather than deciding them implicitly.
