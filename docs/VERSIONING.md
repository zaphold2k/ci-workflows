# Versioning

The source of truth for a repository's version is its git tag, not any
language-specific version file. A tag `v1.2.0` means version `1.2.0`
regardless of whether the repository is Node, Go, Python, or a Makefile
project — two repositories in different languages with the same tag are, by
definition, at the same version. A language's own version file (`package.json`,
etc.), when it exists, is kept in sync by release-please; it is a record, not
the source.

## What each branch produces

| Branch role                          | Simple model                                                                        | Full model                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Work branch (`feature-*`)            | `X.Y.Z-alpha.<branch>.N` prerelease tag + image, plus a moving `<branch>` image tag | Same                                                       |
| Integration branch (`develop`)       | — (doesn't exist)                                                                   | `X.Y.Z-rc.N` candidate tag + image                         |
| Stable branch (`main`), plain push   | Branch-name image tag (e.g. `main`) + commit-sha tag; no version                    | Same                                                       |
| Accepted release-please PR on `main` | Builds the stable version fresh                                                     | Promotes the matching `rc` candidate's digest — no rebuild |
| A branch with no role in the model   | Checks only; no tag, no image                                                       | Same                                                       |

The base version behind a prerelease (`X.Y.Z` in `X.Y.Z-alpha.<branch>.N`) is
the version that _would_ be released next, computed from Conventional Commits
accumulated since the last stable tag — so a prerelease announces the version
it's headed toward, not the one it came from.

## Conventional Commits and the version bump

| Commits since the last stable tag                                            | Bump                                                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Only `fix:`                                                                  | Patch                                                                                                        |
| At least one `feat:`                                                         | Minor                                                                                                        |
| At least one breaking change (`!` or a `BREAKING CHANGE:` footer), major ≥ 1 | Major                                                                                                        |
| At least one breaking change, major == 0                                     | Minor (a major bump on an untagged-1.0 project would claim more stability than the project has committed to) |
| Only other types (`chore`, `docs`, `refactor`, `test`, …)                    | No version proposed                                                                                          |

This is also exactly how release-please computes the stable version; the
prerelease calculation in `scripts/lib/semver.mjs` mirrors it so a prerelease
version and the stable version it becomes never disagree.

## Image tag derivation

| Event                                    | Tags published                                              |
| ---------------------------------------- | ----------------------------------------------------------- |
| Stable tag `vX.Y.Z`, `X` > 0             | `X.Y.Z`, `X.Y`, `X`, `latest`, commit sha                   |
| Stable tag `vX.Y.Z`, `X` == 0            | `X.Y.Z`, `X.Y`, `latest`, commit sha — **no** bare `0` tag  |
| Prerelease tag `vX.Y.Z-alpha.<branch>.N` | `X.Y.Z-alpha.<branch>.N`, commit sha, moving `<branch>` tag |
| Candidate tag `vX.Y.Z-rc.N`              | `X.Y.Z-rc.N`, commit sha only                               |
| Plain push to the stable branch          | Branch name, commit sha                                     |

A bare major tag on the `0.x` series is deliberately withheld: SemVer treats
every `0.x` release as potentially breaking relative to the last, so a shared
`0` tag would silently mix mutually incompatible versions. Prereleases and
candidates never move `latest` or the major/minor tags — publishing an
`alpha` exists so it _can_ be pulled deliberately, not so it's received by
accident.

## Automatic publishing needs a token

release-please creates the stable tag using whichever token `release.yml` is
given. The default `GITHUB_TOKEN` works for opening and updating the release
PR, but GitHub deliberately does not let a `GITHUB_TOKEN`-authored push
trigger another workflow run — otherwise a workflow that creates tags could
retrigger itself indefinitely. That means with no other token configured,
accepting the release PR creates the tag but **does not** trigger `ci.yml`,
and the stable image has to be published by re-running `ci.yml` manually
against that tag.

To get an automatic publish, add a repository secret (`RELEASE_PLEASE_TOKEN`
in the templates) holding a personal access token or a GitHub App
installation token with `contents: write`, and pass it as `release_token` to
`release.yml`. See `docs/BRANCH-PROTECTION.md` for the corresponding
repository settings.

## Self-triggering is avoided differently for prereleases

Work-branch and integration-branch prerelease tags are created by
`scripts/version.mjs` using the run's own default `GITHUB_TOKEN` on purpose,
in the same job that also builds and publishes their image — so there's
nothing to retrigger: the tag and its image come out of one execution, not
two. This is different from the stable-release case above only in that a
prerelease never needs a second, separately-triggered run to publish
anything.
