# Migration guide

Pick the profile below that matches the repository you're migrating. Each
one names which files get replaced, which capability of this component
covers what the repository's current setup does, and the branch model that
fits it — followed by the one step every profile ends with: generating that
repository's flow documentation.

This guide describes repositories by technical profile, not by name, so it
stays usable without knowing which specific repository you're looking at.

## Profile: already has its own CI pipeline

You're replacing a hand-written `.github/workflows/ci.yml` (and, if it
exists, a hand-written coverage-ratchet script) with the templates in
`templates/<language>/`.

1. Note what the current pipeline's coverage threshold or ratchet is, if it
   has one — you're about to make it stricter (zero tolerance by default)
   or looser (no fixed number at all, informational until there's a
   baseline), and it's worth knowing which.
2. Copy the matching `templates/<language>/ci.yml` (see
   `docs/BRANCHING.md` for which branch model fits) over the existing
   workflow file. Map any custom lint/test/build commands the old pipeline
   used into the corresponding `*_command` inputs.
3. If the old pipeline built Docker images with its own steps, delete them —
   `docker-multiarch-build` (this component's Docker job) replaces manual
   `docker build`/`docker push` steps, `docker/setup-qemu-action`, and any
   hand-rolled multi-arch logic.
4. If the old pipeline had its own coverage gate or ratchet script, delete
   it; `quality-ratchet` replaces it. Check whether the old script's
   tolerance value is one you want to keep — see `docs/QUALITY-GATES.md`
   for the `coverage_tolerance` and `coverage_floor` inputs.
5. Copy `release.yml` and the release-please config files if the repository
   didn't already use release-please. If it did, keep its existing
   `.release-please-manifest.json` (which records the current version) and
   only replace the workflow file and, if needed, reconcile
   `release-please-config.json`'s changelog sections.
6. Run the pipeline once on a throwaway branch with `dry_run: true` and
   compare its reported tags and metrics against what the old pipeline
   would have done, before removing the old workflow file for good.

## Profile: no CI yet

The lowest-risk migration: there's nothing existing that adopting this
component could break.

1. Decide the branch model. With no existing pipeline, there's also no
   `develop` branch pressure either way — `docs/BRANCHING.md` has the
   criterion; absent other reasons, start with the simple model.
2. Copy `templates/<language>/{simple,full}/ci.yml`,
   `templates/<language>/release.yml`, and the release-please config files
   into place.
3. If the repository has a Dockerfile and tests but no coverage tooling
   configured, add whatever coverage flag its test runner already supports
   (`--coverage`, `-cover`, `--cov`, depending on language) so
   `collect-metrics.mjs` has something to read; the default `test_command`
   for each language already includes it.
4. Push a work branch first, not directly to the stable branch, so the
   first real exercise of the pipeline is a prerelease rather than a stable
   cut.

## Profile: publishes several binaries from one Dockerfile

You have multiple build targets in a single Dockerfile (multi-stage builds
producing more than one final artifact) and currently either build each one
by hand or maintain separate near-duplicate workflows per binary.

1. Confirm each target in the Dockerfile is named (`FROM ... AS <name>`).
2. Follow the "no CI yet" or "already has a pipeline" steps above for the
   base setup, then list every target for `docker_targets` in `ci.yml`
   (comma-separated). Each target becomes its own published image, sharing
   the same version tags, built independently so one target failing doesn't
   hide a failure in another in the same run.
3. If a fixed coverage threshold existed before this migration, this is the
   natural point to move it to `coverage_floor` (as an absolute minimum
   alongside the ratchet) or drop it in favor of the ratchet alone — a fixed
   number invented from today's coverage doesn't carry meaning on its own.

## Profile: builds with a manual script and a separate per-architecture Dockerfile

You maintain something like a `build.sh` plus two Dockerfiles (one per
architecture) that it selects between manually.

1. Consolidate to a single Dockerfile if the two per-arch versions differ
   only in base image / cross-compilation flags — the `platforms` input's
   QEMU-emulated `linux/arm64` build replaces the second Dockerfile in the
   common case where the difference was only ever about the architecture,
   not genuinely different application code per platform.
2. If the two Dockerfiles differ for a real reason beyond architecture,
   this component doesn't have a mechanism for that today; keep the manual
   script for that specific case and adopt the rest of the pipeline around
   it, or treat each Dockerfile as a separate `docker_targets` entry if that
   fits the actual difference.
3. Replace the manual script's build-and-push logic with `ci.yml`'s Docker
   job entirely; `build.sh` should no longer be invoked by anything once
   this migration is done.
4. Since `build.sh` likely had its own way of tagging images, check its
   tagging scheme against `docs/VERSIONING.md`'s table before deleting it,
   in case something downstream depends on a tag format this component
   doesn't produce.

## Every profile ends here: generate the flow documentation

Once `ci.yml` and `release.yml` are in place, run `render-docs.mjs` once
(see any `templates/<language>/README.md` for the exact command) to install
the flow block in `README.md` and the repository's agent docs. `ci.yml`
checks on every run afterward that this block still matches the declared
configuration, so a later change to the branch model or image name without
regenerating the block fails the repository's own verification rather than
silently going stale.
