# Dry-run mode

`dry_run: true` runs the full pipeline exactly as it would run otherwise —
same lint, typecheck, test, build, metrics, ratchet comparison, image build,
and smoke test — and suppresses only the last step of each _effect_: no
image is pushed, no git tag is created or moved, no digest is promoted, no
release or release PR is created, no pull-request comment is written. What
would have happened is written to the job summary instead.

The gate that determines the reason to reach for it: dry run exercises the
same decisions a real run would make, so it's the way to verify a change to
this component itself, or to a repository's adoption of it, without paying
for a mistake in a shared registry or a repository's git history.

## When to use it

- **Changing something in ci-workflows itself.** Push your change and
  invoke `ci.yml` with `dry_run: true` against a test project before
  merging, so an error in tag derivation or digest resolution shows up in a
  job summary instead of a bad tag in someone's repository.
- **Adopting the component in a repository for the first time.** Run once
  with `dry_run: true` to see exactly what tags and images the first real
  run would produce, before it produces them.
- **Changing a repository's configuration** (branch model, image name,
  coverage tolerance) — the same reasoning applies to a change in an
  established repository as to adopting it fresh.

## What the summary shows

- Every tag and image reference that would have been published, with the
  registry it would have gone to.
- The git tag(s) that would have been created (and, on a stable release in
  the full model, which candidate digest would have been promoted instead of
  rebuilt).
- The full text of the PR comment the ratchet would have posted.
- Whether the ratchet comparison would have blocked the run — reported, not
  enforced: dry run exists to observe the pipeline, not to judge the
  repository being exercised with it, and blocking here would hide the rest
  of the report behind the first regression found.

The report is produced even when a verification stage fails partway
through, so a failure early in the run doesn't hide what the rest of the
pipeline would otherwise have done.

## What still fails a dry run

Everything that isn't an _external_ effect behaves exactly as normal:
failing tests, a failing build, an unresolvable Docker build, a language
input outside `node`/`go`/`python`/`make` — all fail the run in dry-run mode
exactly as they would without it. Only the publish step of each effect is
suppressed.

## Verifying a change to this component

1. Point a test project's `ci.yml` invocation at your branch:
   `uses: zaphold2k/ci-workflows/.github/workflows/ci.yml@<your-branch>`.
2. Add `dry_run: true`.
3. Push, and read the job summary against what you expected to change.
4. Once satisfied, run once _without_ `dry_run` against the same test
   project before merging, to exercise the real registry/tag paths your
   dry run intentionally skipped.
