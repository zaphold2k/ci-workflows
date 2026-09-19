# make template

1. Pick your branch model and copy the matching workflow:
   - Simple (no intermediate branch): `simple/ci.yml` → `.github/workflows/ci.yml`
   - Full (adds `develop`): `full/ci.yml` → `.github/workflows/ci.yml`
2. Copy `release.yml` → `.github/workflows/release.yml`.
3. Copy `release-please-config.json` and `.release-please-manifest.json` to your repository root.
4. Replace `ghcr.io/OWNER/REPO` in `ci.yml` with your image name (or delete the `image_name` line to derive it automatically).
5. If you want an accepted release to publish automatically instead of needing a manual re-run, add a `RELEASE_PLEASE_TOKEN` repository secret (a PAT or GitHub App token) — see `docs/VERSIONING.md`.
6. Generate this repository's flow documentation block once:
   ```
   node path/to/ci-workflows/scripts/render-docs.mjs \
     --language make --branch-model simple --main-branch main \
     --work-branch-pattern 'feature-*' --image ghcr.io/OWNER/REPO \
     --readme README.md --agent-docs AGENTS.md,CLAUDE.md
   ```
   (ci.yml re-checks this on every run and fails if it drifts from the declared configuration.)

Make-specific: no toolchain is installed. Every stage delegates to a same-named Makefile target (`make install`, `make lint`, `make typecheck`, `make test`, `make build`); provide whichever of those your project needs and leave the rest to fail naturally if invoked without a target.
