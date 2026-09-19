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

## Minimal usage

```yaml
name: CI

on:
  push:
    branches: ["main", "develop", "feature-*"]
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
```

See `templates/` for a ready-to-copy pipeline per language, and `docs/` for
the full reference on inputs, branch models, versioning, and the quality
gates.

## License

MIT — see [LICENSE](LICENSE).
