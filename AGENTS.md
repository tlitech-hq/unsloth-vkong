# Agent guide for the Unsloth + VKong fork

This is TLI Tech's experimental fork of Unsloth, not an official release. It adds a
"Train on VKong" button to Unsloth Studio. Preserve upstream's `unsloth` distribution,
imports and `unsloth studio` command, and respect upstream [CONTRIBUTING.md](CONTRIBUTING.md).

**Keep the fork thin.** Integration logic lives in
[vkong-connect](https://github.com/tlitech-hq/vkong-connect)
(`vkong_connect.integrations.unsloth_studio`). This fork may only add new files
(`vkong/`, `studio/frontend/src/features/remote-training/`) and the few-line hooks listed
in [vkong/VKONG_PATCHES.md](vkong/VKONG_PATCHES.md). Any new edit to an upstream file
must be added to that list. Rationale: vkong-connect `docs/decisions/0004-thin-unsloth-fork.md`.

VKong is reached only through the `vkong` CLI via vkong-connect, never through a VKong
API. Local training must keep working when vkong-connect is not installed.

Branches: `main` mirrors upstream; the fork's work lives on `vkong`. To follow upstream:
`git fetch upstream && git switch vkong && git merge upstream/main`, then run
vkong-connect's `make check` against this checkout.

Work is tracked in GitHub Issues on `tlitech-hq/vkong-connect` with `area/studio`.
Read [vkong/README.md](vkong/README.md) and [vkong/ENGINEERING_PRINCIPLES.md](vkong/ENGINEERING_PRINCIPLES.md)
before changing the integration. Report focused test results and any untested GPU or
live-CLI path.
