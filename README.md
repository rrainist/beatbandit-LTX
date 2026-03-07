# BeatBandit LTX Overlay

This repository is a small overlay bundle for adding the BeatBandit integration on top of an existing [`LTX-Desktop`](https://github.com/Lightricks/LTX-Desktop) checkout.

It does **not** contain the full LTX codebase.

## What Is Included

- Only the files changed for the BeatBandit integration
- `CHANGED_FILES.txt` listing every overlaid path
- `beatbandit-LTX-overlay.patch` containing one unified diff for review

## Upstream Base

This overlay was produced against upstream `LTX-Desktop` base commit:

- `32589e6f0d4d5b7a28e9c1e8da9ed82916c4513e`

## How To Apply

1. Clone the upstream LTX Desktop source into a local folder.
2. Download or clone this overlay repository.
3. Review `CHANGED_FILES.txt` and `beatbandit-LTX-overlay.patch`.
4. Copy the files from this repository into the root of your LTX Desktop clone.
5. Overwrite existing files when prompted.
6. Install dependencies if needed (use `pnpm` or `npm`):
   - `pnpm install`
   - in backend folder, `uv sync --extra dev`
7. Optionally verify:
   - `pnpm run typecheck:ts`
   - `pnpm dlx tsx frontend/test/beatbandit-import.smoke.ts`
8. Build LTX Desktop normally from your patched checkout, or simply run `pnpm dev` to start it. 

## Main Changes

- BeatBandit ZIP import support in Electron and the frontend
- BeatBandit import modal updates and import configuration
- Native BeatBandit project import mapping into LTX assets and timelines
- Batch command to generate missing BeatBandit shots
- Multi-lane import option so each shot can be duplicated across `V1..V5`
- Regeneration fixes so BeatBandit placeholder images become proper video assets
- Clearer validation error messaging for failed generations
- Windows local video generation threshold lowered to `20 GB` VRAM for CUDA systems

## Notes

- If `package.json` or `pnpm-lock.yaml` changed, keep those overlay files too.
- This repository is meant to stay easy to audit: users can inspect every changed file directly.
