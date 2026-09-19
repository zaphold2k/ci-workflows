# Quality gates

The ratchet compares this run's metrics against the last successful run of
the branch being integrated into, and blocks the ones that make the
repository worse. It never compares against a fixed number: an invented
threshold on today's coverage would be arbitrary, and the first run of a
repository — with no baseline yet — reports its metrics and passes, because
there's nothing yet to regress against.

## The metrics

| Metric                                            | Blocks when                                                           | Tolerance                         |
| ------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------- |
| Coverage (lines, statements, functions, branches) | Any one drops below baseline by more than `coverage_tolerance` points | `coverage_tolerance`, default `0` |
| Tests passed                                      | Drops below baseline                                                  | None — exact integers             |
| Tests skipped                                     | Rises above baseline                                                  | None                              |
| Lint/type-check suppressions                      | Rises above baseline                                                  | None                              |
| Coverage floor (optional)                         | Falls below `coverage_floor`, independent of baseline                 | N/A — absolute                    |

A metric a toolchain doesn't report (Go's branch coverage, for instance) is
recorded as absent, never as zero — "not measured" and "regressed to zero"
are different facts, and treating the first as the second would block every
Go repository on its second run.

## Why each one exists

- **Coverage** is the obvious one, but zero tolerance by default is
  deliberate: for code an agent writes, a half-point of slack is exactly the
  margin a real regression can hide in without anyone noticing. If your
  repository's coverage is genuinely noisy for reasons unrelated to the
  change (flaky instrumentation, parallel test ordering), raise
  `coverage_tolerance` for that repository specifically rather than for
  everyone.
- **Test count** exists because coverage is a percentage: deleting ten
  redundant tests that happened to cover the same lines as ten others leaves
  coverage unchanged while quietly shrinking what's actually verified. This
  is the check that catches "fewer tests, same coverage number."
- **Skipped tests** exists because marking a test `skip` is the same move as
  deleting it, dressed up to look temporary.
- **Lint suppressions** exists because silencing a rule is the same move
  again, aimed at the linter instead of the test suite.

## If a gate blocks you

| Blocked by                  | Do this                                                                                  | Don't do this                                  |
| --------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Coverage drop               | Add the tests that cover the new code                                                    | Lower `coverage_tolerance` or `coverage_floor` |
| Fewer passing tests         | Restore the missing test cases                                                           | Delete or skip a failing test to make it pass  |
| More skipped tests          | Un-skip it and fix what it was skipping, or delete it _and_ the code it covered together | Leave it skipped "for now"                     |
| More lint/type suppressions | Fix the underlying issue                                                                 | Add the suppression to get through the gate    |

Every one of these is legitimately overridable when the change really is a
deliberate improvement that happens to look like a regression — a real
refactor that consolidates ten tests into three better ones, for instance.
That's what the override label is for.

## The override label

Apply `ci-ratchet-override` to the pull request. The ratchet then reports the
regression instead of blocking on it — the report stays, the exception is
recorded, but the merge isn't stopped.

This is a **label on the pull request**, not a workflow input or something
that lives in a commit message, and that's deliberate: an override that the
same agent editing the code could also flip on its own would just be one
more thing the agent has to remember not to touch. Applying the label
requires a separate, visible action on the PR, and it's attributed and dated
in that PR's history — a human decision, not a configuration value. An agent
that hits a block should fix the cause or explain in the PR why the
regression is warranted; it should never apply the label itself.

## No permission to comment

If the pipeline can't write a comment on the pull request — most commonly
because it's running against a fork, which by default gets a read-only
token — the comparison result still lands in the job's summary, and the
missing comment does not change whether the run passes or fails. Losing
visibility in one place isn't allowed to become a second, unrelated failure.
