# AGENTS.md

Operating notes for an agent working on **ci-workflows itself** — not for a
repository that consumes it. If you were sent here from a consumer
repository's own `AGENTS.md`, you're in the wrong place: that repository's
generated flow block (see `docs/BRANCHING.md`) is what governs it, not this
file.

## What this is

Reusable GitHub Actions workflows — CI, an incremental quality ratchet, and
multi-arch Docker publishing — for Node, Go, Python, and Make projects. See
`README.md` for the pitch and `openspec/changes/*/design.md` for the design
rationale behind every non-obvious decision in this codebase; read the
relevant design section before changing behavior it explains, since most of
what looks like an arbitrary choice here (zero-tolerance default, the
override as a PR label and not an input, digest promotion instead of
rebuilding, `null` instead of `0` for an unmeasured metric) is actually a
documented tradeoff.

## Layout

- `.github/workflows/` — the reusable workflows themselves (`ci.yml`,
  `release.yml`) plus this repository's own (`self-check.yml`,
  `release-please.yml`).
- `scripts/` — dependency-free Node scripts, each independently testable
  with `node --test`. `scripts/lib/` holds the pure logic (branch-role
  resolution, SemVer, image-tag derivation); the top-level scripts are the
  CLI entrypoints `ci.yml` invokes.
- `templates/<language>/` — copy-paste starting points for consumers.
- `docs/` — the reference documentation; `docs/INPUTS.md` is the source of
  truth for every workflow input's current default.
- `tests/fixtures/` — sample reports and (once section 10 of the change is
  complete) minimal per-language test projects used by both unit tests and
  the component's own dry-run verification.

## Modifying the component

1. Check whether an `openspec/changes/*/specs/*/spec.md` delta already
   describes the behavior you're changing — the SHALL/scenario requirements
   there are the actual contract, not this file or the code's comments.
2. Keep every script in `scripts/` dependency-free (Node's standard library
   only) — see `openspec/changes/add-reusable-ci-workflows/design.md` for
   why. `gh` and `docker` are invoked as external CLIs, already present on
   GitHub-hosted runners.
3. Before committing: `npm test`, `npm run lint`, `npx prettier --check .`.
   For a changed workflow file, validate it with
   [actionlint](https://github.com/rhysd/actionlint) (`actionlint
.github/workflows/*.yml`) — install it with
   `bash <(curl -sL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)`
   if it isn't already on your machine.
4. Follow `CODESTYLE.md`. In particular: English everywhere in code and
   comments, comments only for a genuinely non-obvious invariant, and no
   suppressed lint/type/test failures anywhere in this repository — it
   would be indefensible for the tool that blocks exactly that pattern in
   consumer repositories to do it in its own.

## Exercising a change before it merges

Point a test project's own thin `ci.yml` at your branch instead of a
released tag, and add `dry_run: true`:

```yaml
jobs:
  ci:
    uses: zaphold2k/ci-workflows/.github/workflows/ci.yml@your-branch-name
    with:
      language: node
      dry_run: true
```

Read `docs/DRY-RUN.md` for exactly what dry-run mode does and doesn't
suppress. Run once more _without_ `dry_run` against the same test project
before merging, so the real registry/tag paths get exercised too, not only
the ones dry run intentionally skips.

## Before a new path is available to consumers

A "path" here means a new input, a new language, a new branch role, or a
new event this component reacts to. Before it merges:

- Unit tests cover the new pure logic in `scripts/lib/` directly — don't
  rely on exercising it only through a full workflow run.
- If it touches metrics collection, add a fixture under
  `tests/fixtures/metrics/` for the new report shape, including its
  missing-metric and malformed-report cases (see
  `scripts/collect-metrics.test.mjs` for the existing pattern).
- The self-verification matrix (`tests/fixtures/*` projects exercised by
  this repository's own workflows) covers the new path — see
  `openspec/changes/add-reusable-ci-workflows/specs/dry-run/spec.md`'s
  "Cobertura de los pasos del componente" requirement. A new path with no
  matrix coverage is exactly the situation that requirement exists to
  prevent.
- `docs/` reflects the new behavior — in particular `docs/INPUTS.md` if you
  added or changed an input.

## A convention that outlives any single change

Nothing published from this public repository names a private consumer
repository or describes its internal structure — planning artifacts and
docs describe a repository by its technical profile (language, what it
publishes, how it currently builds) instead. See `docs/MIGRATION.md` for the
pattern this takes in practice. This applies to every future change here,
not only the one that first wrote it down.

## Commits and versioning

Conventional Commits, English, imperative subject — see `CODESTYLE.md`.
This repository versions itself through `release-please.yml` /
`release.yml`, the same as any consumer: don't hand-edit `CHANGELOG.md` or
`.release-please-manifest.json`.
