# Branch models

This component supports exactly two branch models. Which one a repository
uses is a declared input (`branch_model: simple | full`), never inferred from
which branches happen to exist — a `develop` branch might be a leftover from
a previous setup, or about to be created; guessing from it would silently
change behavior no one asked for.

## Simple

```
feature-* ──► main
```

- `main` is the stable branch.
- Branches matching `work_branch_pattern` (default `feature-*`) integrate
  directly into `main`.
- A push to a work branch produces a prerelease tag and image.
- Accepting the release-please PR on `main` builds and publishes the stable
  version directly — there's no earlier build to promote instead.

## Full

```
feature-* ──► develop ──► main
```

- `main` is the stable branch, `develop` is the integration branch.
- Work branches integrate into `develop`; `develop` integrates into `main`.
- A push to a work branch produces a prerelease tag and image, compared
  against `develop`'s baseline.
- A push to `develop` produces a release-candidate (`rc`) tag and image.
- Accepting the release-please PR on `main` **promotes** the digest of the
  latest matching `rc` candidate rather than rebuilding — the image that
  reaches `latest` is bit-for-bit the one that was already tested on
  `develop`.

## Which one to pick

Use the **full** model when there's real value in integrating several
in-flight changes together before they reach `main` — enough concurrent work
that you want a shared, buildable checkpoint that isn't yet a release
candidate for users. Use the **simple** model otherwise, including for a
repository with a single active branch of work at a time: the extra branch
buys nothing there and only adds a merge step.

If a repository doesn't declare a model yet, an agent operating on it should
choose based on what it can observe (existing branches, how many concurrent
lines of work the issue tracker suggests, whether `develop` already exists
for a real reason) and say why — but once a model _is_ declared, that
declaration wins even if the repository's current shape suggests the other
one would fit better. Raise the discrepancy; don't change the declaration
unilaterally.

## Naming your branch

A work branch's name must match `work_branch_pattern` (default `feature-*`)
for the pipeline to recognize it. A branch outside every declared pattern —
not the stable branch, not the integration branch, not a work-branch match —
still runs the full verification pipeline, but produces no tag and no image.
That's the correct behavior for an experimental branch: you find out whether
it breaks anything without it leaving tags or images behind.

The separator right after the pattern's prefix doesn't matter: `feature-*`
and a branch named `feature/login-oauth` sanitize to the same identifier
(`login-oauth`) as `feature-login-oauth` would, so pick whichever separator
convention your team already uses.

## Closing a work branch

Once a work branch is merged and its PR is closed, its prerelease tags
(`vX.Y.Z-alpha.<branch>.1`, `.2`, …) remain in the repository — they're cheap,
easy to identify by name, and harmless to leave. If you want to clean them
up:

```
git tag -l 'v*-alpha.<branch>.*' | xargs -r git tag -d
git push origin --delete $(git tag -l 'v*-alpha.<branch>.*')
```

Deleting these tags does **not** affect any image already published under
them — a registry tag, once pushed, is independent of the git tag that named
it.
