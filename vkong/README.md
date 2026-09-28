# Unsloth Studio + VKong

This fork adds a **Train on VKong** button to Unsloth Studio. You configure the model,
dataset and training settings in Studio as usual, press the button, and the job runs
on a rented VKong GPU. The GPU is released automatically when training ends, and the
trained adapter is pushed to a private Hugging Face repository.

Experimental proof of concept. Not an official Unsloth release.

## Install

Requirements: macOS, Linux or WSL with `git`; a VKong account; a Hugging Face account.

```bash
git clone -b vkong https://github.com/tlitech-hq/unsloth-vkong.git
cd unsloth-vkong
./install.sh --local                  # upstream Studio installer, from this checkout
./vkong/install-vkong-connect.sh      # adds VKong support to the Studio environment
```

Install the VKong CLI from <https://vkong.tli-tech.com/download>, then sign in once:

```bash
vkong login
```

In the VKong dashboard, create an App secret named **`huggingface`** with the key
**`HF_TOKEN`** (a Hugging Face token with write access). The GPU host reads the token
from that secret; Studio never sends your local token.

## Use

1. Start Studio: `unsloth studio`.
2. Choose a model and a dataset (a Hugging Face dataset, or an uploaded
   `.json`/`.jsonl`/`.csv` file up to 50 MB) and set the training options.
3. Press **Train on VKong**, enter the output repository (`username/repo`), the GPU
   (`Any`, `RTX 4090`, `A100`, …) and the maximum price per hour, then **Start on VKong**.
4. The job appears under the button with its state. **Stop** releases the GPU. When it
   finishes, **Open output** links to the Hugging Face repository.

## Current limits

- LoRA/QLoRA only. No checkpoint resume.
- No live loss chart yet: the VKong CLI does not stream Run logs in a machine-readable
  form, so Studio shows the job state only.
- Development runtime: the GPU host starts from the official `unsloth/unsloth:studio`
  image and installs this fork's Studio backend and vkong-connect at the exact commits
  you have installed. The first start pulls a large image and takes several minutes.
  Commits that are not pushed to GitHub cannot be used remotely.

## How it works

Studio's backend mounts routes from [vkong-connect](https://github.com/tlitech-hq/vkong-connect)
under `/api/remote-training`. vkong-connect talks to VKong **only through the `vkong`
CLI** (`validate`, `run --detach --auto-stop`, `app list/show/stop`, `runs`); it never
calls a VKong API or reads the CLI's credentials.

Fork changes to upstream files are kept to a few lines so upstream updates merge
cleanly; see [ENGINEERING_PRINCIPLES.md](ENGINEERING_PRINCIPLES.md) and
[`VKONG_PATCHES.md`](VKONG_PATCHES.md).
