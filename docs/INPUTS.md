# Inputs reference

## `ci.yml`

| Input                 | Type    | Default                   | Meaning                                                                                                                                       |
| --------------------- | ------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `language`            | string  | _required_                | `node`, `go`, `python`, or `make`. An unsupported value fails the run immediately, before any other step.                                     |
| `runtime_version`     | string  | `""`                      | Toolchain version. Empty uses each language's latest stable (`lts/*` for Node, `stable` for Go, `3.12` for Python; not applicable to `make`). |
| `working_directory`   | string  | `.`                       | Directory every command and Docker context runs relative to.                                                                                  |
| `install_command`     | string  | `__lang_default__`        | Override the install step. The sentinel means "use the language default"; an explicit `""` skips the stage.                                   |
| `lint_command`        | string  | `__lang_default__`        | Same pattern as `install_command`.                                                                                                            |
| `typecheck_command`   | string  | `__lang_default__`        | Same pattern. Python's language default is `""` (no universal typechecker) unless overridden.                                                 |
| `test_command`        | string  | `__lang_default__`        | Same pattern.                                                                                                                                 |
| `build_command`       | string  | `__lang_default__`        | Same pattern. Python's language default is `""`.                                                                                              |
| `e2e_command`         | string  | `""`                      | No language has a default here — empty means "not declared," which is also "skip."                                                            |
| `coverage_tolerance`  | number  | `0`                       | Percentage points of coverage drop tolerated before the ratchet blocks. `0` is strict.                                                        |
| `coverage_floor`      | string  | `""`                      | Absolute minimum line-coverage percentage, independent of the baseline. Empty disables it.                                                    |
| `branch_model`        | string  | `simple`                  | `simple` or `full` — see `docs/BRANCHING.md`.                                                                                                 |
| `main_branch`         | string  | `main`                    | The stable branch's name.                                                                                                                     |
| `integration_branch`  | string  | `develop`                 | The integration branch's name. Only relevant when `branch_model: full`.                                                                       |
| `work_branch_pattern` | string  | `feature-*`               | Glob a branch name must match to be treated as a work branch.                                                                                 |
| `image_name`          | string  | `""`                      | Full image name. Empty derives `<registry>/<owner>/<repo>` (lowercased) from the consumer repository.                                         |
| `dockerfile`          | string  | `Dockerfile`              | Path relative to `working_directory`. Empty skips the Docker job entirely — for a repository with nothing to containerize.                    |
| `platforms`           | string  | `linux/amd64,linux/arm64` | Comma-separated platforms to build. Restricting to `linux/amd64` skips arm64 without failing.                                                 |
| `publish_image`       | boolean | `true`                    | `false` builds and verifies on every event but never pushes to a registry.                                                                    |
| `registry`            | string  | `ghcr.io`                 | Registry to authenticate against and push to.                                                                                                 |
| `smoke_test_endpoint` | string  | `""`                      | e.g. `http://localhost:8080/health`. Empty means the image is verified by building only, not by running it.                                   |
| `smoke_test_port`     | string  | `8080`                    | Port to publish and probe.                                                                                                                    |
| `smoke_test_env`      | string  | `{}`                      | JSON object of environment variables for the smoke-test container.                                                                            |
| `smoke_test_timeout`  | number  | `60`                      | Seconds to wait for `smoke_test_endpoint` to respond before failing.                                                                          |
| `dry_run`             | boolean | `false`                   | See `docs/DRY-RUN.md`.                                                                                                                        |
| `readme_path`         | string  | `README.md`               | Where the generated flow block is checked. Empty disables the check.                                                                          |
| `agent_docs`          | string  | `AGENTS.md,CLAUDE.md`     | Comma-separated agent-doc paths carrying the same block. Empty disables the check.                                                            |

### Secrets

| Secret              | Required | Meaning                                                            |
| ------------------- | -------- | ------------------------------------------------------------------ |
| `registry_username` | No       | Falls back to `github.actor`. Only needed for a non-GHCR registry. |
| `registry_password` | No       | Falls back to `github.token`. Only needed for a non-GHCR registry. |

## `release.yml`

| Input           | Type   | Default                         | Meaning                                                                                                                                 |
| --------------- | ------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `target_branch` | string | `main`                          | Branch release-please manages releases against.                                                                                         |
| `config_file`   | string | `release-please-config.json`    | Path to the consumer's own release-please config (its `release-type` is read from there, not from an input — see `docs/VERSIONING.md`). |
| `manifest_file` | string | `.release-please-manifest.json` | Path to the consumer's own manifest.                                                                                                    |

### Secrets

| Secret          | Required | Meaning                                                                                                                                           |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `release_token` | No       | PAT or GitHub App token. Without it, the tag release-please creates uses `GITHUB_TOKEN` and does not trigger `ci.yml` — see `docs/VERSIONING.md`. |

### Outputs

| Output            | Meaning                                                                      |
| ----------------- | ---------------------------------------------------------------------------- |
| `release_created` | Whether this run created a release (i.e., the pending PR was just accepted). |
| `tag_name`        | The tag created, when `release_created` is true.                             |
