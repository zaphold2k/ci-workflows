# ci-workflows

Reusable GitHub Actions workflows for CI, an incremental quality ratchet, and
multi-arch Docker publishing — shared across Node, Go, Python, and Make
projects so a pipeline improvement lands in every repository at once instead
of being copy-pasted by hand.

## Why

Most CI pipelines only answer "green or red." For code written by an AI
agent, the fastest way to green is deleting the failing test, skipping it, or
silencing the linter — and that passes CI while making the product worse.
This component measures the _direction_ of a change (coverage, test count,
lint suppressions) against the last known-good run of the branch it's
integrating into, and blocks the ones that make things worse.

## What it does

| Capability             | What it means                                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CI pipeline**        | One workflow, one `language` input (`node`, `go`, `python`, `make`) — install, lint, typecheck, test, build, with every command overridable per repository.                                                                                   |
| **Quality ratchet**    | Normalized coverage, test-count, and lint-suppression metrics compared against the target branch's last successful run. Blocks regressions; informs without blocking when there's no baseline yet.                                            |
| **Multi-arch Docker**  | Builds and publishes `linux/amd64` + `linux/arm64` under one image name, verified (build, optional smoke test) before anything is pushed.                                                                                                     |
| **Release versioning** | The git tag is the version's source of truth for every language. Two branch models, each push producing an identifiable, correctly-ordered SemVer tag; changelog and releases from Conventional Commits via release-please.                   |
| **Agent playbook**     | Each adopting repository gets a generated, verified-current doc block describing its own concrete flow — which branch to work from, what each push produces, how to cut a package, and that the quality gate isn't something to route around. |
| **Dry run**            | Exercises the entire pipeline's decisions with every external effect (publish, tag, comment) suppressed and reported instead.                                                                                                                 |

## Minimal usage

```yaml
name: CI

on:
  push:
    branches: ["main", "feature-*"]
  pull_request:

jobs:
  ci:
    uses: zaphold2k/ci-workflows/.github/workflows/ci.yml@v1
    with:
      language: node
    permissions:
      contents: write
      packages: write
      pull-requests: write
      actions: read
```

See `templates/<language>/README.md` for the full copy-paste setup
(`node`, `go`, `python`, `make`), including the release workflow and
release-please configuration.

## Branch models

|                           | Simple                            | Full                                                            |
| ------------------------- | --------------------------------- | --------------------------------------------------------------- |
| Branches                  | `main` + work branches            | `main` + `develop` + work branches                              |
| Work branch push produces | Prerelease tag + image            | Same                                                            |
| Integration push produces | —                                 | `rc` candidate tag + image                                      |
| Stable release            | Builds fresh                      | Promotes the matching `rc` digest — no rebuild                  |
| Pick this when            | One active line of work at a time | Enough concurrent work to want a shared, pre-release checkpoint |

Full reference: [`docs/BRANCHING.md`](docs/BRANCHING.md) ·
[`docs/VERSIONING.md`](docs/VERSIONING.md).

## Documentation

- [`docs/INPUTS.md`](docs/INPUTS.md) — every input, default, and secret.
- [`docs/BRANCHING.md`](docs/BRANCHING.md) — the two branch models and how to choose.
- [`docs/VERSIONING.md`](docs/VERSIONING.md) — tag-to-artifact rules and Conventional Commits.
- [`docs/QUALITY-GATES.md`](docs/QUALITY-GATES.md) — each ratchet metric, and what to do when it blocks you.
- [`docs/BRANCH-PROTECTION.md`](docs/BRANCH-PROTECTION.md) — making the check actually block a merge.
- [`docs/DRY-RUN.md`](docs/DRY-RUN.md) — exercising a change safely.
- [`docs/MIGRATION.md`](docs/MIGRATION.md) — adopting this in an existing repository, by profile.
- [`AGENTS.md`](AGENTS.md) — operating notes for working on this repository itself.

## License

MIT — see [LICENSE](LICENSE).
