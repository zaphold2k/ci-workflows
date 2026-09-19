# Code Style Guide

This document is the style contract for everything in this repository: workflow
YAML, Node scripts, shell steps, templates, tests, and engineering docs
(`README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/*.md`). It exists so the
component itself models the standard it enforces on consumers — a pipeline
that measures regressions has no credibility if its own code is sloppy.

Planning artifacts under `openspec/` follow their own established convention
(Spanish) and are out of scope here. Changelog section titles are a
`release-please` configuration concern documented in `docs/VERSIONING.md`, not
a code style rule.

## Language

All source code, identifiers, comments, docstrings, commit messages, error
strings, log output, and engineering documentation are written in English.
This includes YAML `name:` fields, workflow step descriptions, script output
printed to the job summary, and PR comment templates. No mixed-language
identifiers, no transliterated Spanish variable names.

Conventional Commit type prefixes (`feat:`, `fix:`, `chore:`, `refactor:`,
`docs:`, `test:`) and their subject/body text are English.

## General principles

- **Production-ready by default.** No TODOs left unaddressed, no commented-out
  code, no placeholder logic shipped as if finished. If something is
  intentionally incomplete, it doesn't merge.
- **Debuggable first.** Optimize for the person (or agent) reading a failed
  run at 2am with no prior context, not for the person writing the code today.
- **Deterministic.** Given the same inputs (repo config, event payload, fixture
  reports), a script or workflow produces the same output. No reliance on
  wall-clock timing, unseeded randomness, or execution order between
  independent steps.
- **Small, single-purpose units.** A script does one job (`collect-metrics.mjs`
  collects, `ratchet.mjs` compares, `render-docs.mjs` renders). A function
  does one thing and is named after it.
- **No speculative abstraction.** Don't generalize for a fifth language,
  branch model, or coverage tool that doesn't exist yet. Four concrete
  `if` branches beat one premature dispatch table built for a case that isn't
  there.

## Comments

Comments are scarce and strictly technical. Default to no comment — a
well-named function or variable already says what the code does.

Write one only to capture something the code cannot express on its own:

- A non-obvious invariant ("counts JUnit `<testcase>` elements, not the
  suite's `tests` attribute — reporters disagree on whether skipped tests
  count toward it").
- A workaround for a specific external limitation ("Actions expressions have
  no substring function; parsed in shell instead").
- A deliberate absence ("emits `null`, not `0` — Go doesn't report branch
  coverage, and `0` would read as a regression").

Never write a comment that restates the identifier, narrates what the next
line obviously does, references an issue/PR number, or explains history that
belongs in the commit message. If a comment would go stale the moment the
code changes, delete the comment or fix the code so it isn't needed.

## Naming

- **Files:** `kebab-case.mjs` for scripts, `kebab-case.yml` for workflows,
  `UPPER-CASE.md` for top-level docs that name a concept (`VERSIONING.md`,
  `BRANCHING.md`), `README.md`/`AGENTS.md`/`CLAUDE.md` as fixed names.
- **JavaScript:** `camelCase` for variables and functions, `PascalCase` for
  classes, `UPPER_SNAKE_CASE` for module-level constants that are effectively
  configuration (`DEFAULT_TOLERANCE`, `SUPPORTED_LANGUAGES`).
- **Workflow inputs/outputs:** `snake_case`, matching GitHub Actions
  convention, and named after what they configure, not how they're
  implemented (`branch_model`, not `use_develop_branch`).
- **Booleans** read as a predicate: `isSuppressed`, `hasBaseline`, `dryRun` —
  never `flag`, `status`, or `data`.
- No abbreviations that aren't standard in the domain (`cfg`, `msg` are fine;
  `mtrx` or `covrg` are not).

## Formatting

Formatting is enforced by tooling, never by hand or by convention alone.

- **JavaScript (`.mjs`):** Prettier defaults (2-space indent, semicolons,
  single quotes) plus ESLint with no disabled rules in committed code. ESM
  only — no `require`, no `.js` with CommonJS semantics.
- **YAML (workflows, `release-please` config):** 2-space indent, no tabs, no
  trailing whitespace, `---` not required for single-document files.
  Multi-line `run:` blocks use `|` and are indented consistently with the
  surrounding step.
- **Shell embedded in `run:` steps:** `set -euo pipefail` at the top of any
  step with more than one command; quote every variable expansion; prefer a
  named step output over parsing another step's stdout ad hoc.
- **Markdown:** one sentence per line is not required, but headings form a
  strict hierarchy (no skipped levels), fenced code blocks always declare a
  language, and tables are used only for genuinely tabular data (the inputs
  reference, the branch-model comparison), not as a layout trick.
- **Every file ends with a single trailing newline.** No trailing whitespace
  anywhere.

Formatting and lint checks run in this repository's own CI and block merge —
the same gate this component imposes on consumers.

## Structure

- `.github/workflows/` — the reusable workflows themselves (`ci.yml`,
  `release.yml`). Language-specific stages live in clearly marked, contiguous
  sections of the single `ci.yml`, not scattered across the file.
- `scripts/` — standalone, dependency-free Node scripts, each independently
  testable via `node --test` without spinning up a workflow.
- `templates/<language>/` — copy-paste starting points per consumer language;
  each one is a complete, minimal, working pipeline, not a fragment.
- `docs/` — one topic per file, named after the topic (`VERSIONING.md`,
  `BRANCHING.md`, `QUALITY-GATES.md`), cross-linked from `README.md` rather
  than duplicated into it.
- `tests/fixtures/` — minimal real projects and sample reports, one per
  format/scenario, used by both unit tests and the component's own dry-run
  verification matrix.

A script that grows multiple responsibilities is split, not left to grow. A
workflow section that stops fitting on one screen is a signal to extract
logic into `scripts/`, not to add another nested conditional.

## Error handling & debuggability

- **Fail loud, fail fast.** An unsupported `language` input, a missing
  integration branch, or a digest that doesn't exist in the registry stops
  the run immediately with a message that names the actual bad value and what
  was expected — never a silent fallback to a default behavior.
- **No swallowed errors.** Don't catch an exception without either handling it
  meaningfully or re-throwing with added context. A denied comment permission
  is an explicit, tested "don't fail the run" path — not an empty `catch {}`.
- **Context in every error.** Error messages name the repository, branch,
  workflow step, and value involved, not just "something went wrong."
- **Absence is not zero.** A metric a toolchain doesn't report is emitted as
  explicitly absent, never coerced to `0`, `null`-as-false, or an empty
  string treated as a passing value.
- **No secrets in output.** No token, credential, or registry password ever
  reaches a log line, job summary, or PR comment, including in error paths.

## Testing

- Every script in `scripts/` has unit tests runnable with Node's native test
  runner — no external test framework dependency.
- Tests cover the missing-metric, empty-report, and malformed-report cases
  explicitly, not just the success path.
- A test is never skipped, marked pending, or deleted to make a run pass. If a
  test is wrong, fix or replace it in the same change and say so in the
  commit message — this is the exact behavior the quality ratchet exists to
  catch, and it applies to this repository's own code first.
- Lint and type-check suppressions are not added to satisfy a failing gate;
  fix the underlying issue or, if the suppression is genuinely correct,
  justify it with the technical comment rule above.

## Commits

Conventional Commits, English, imperative mood in the subject
(`fix: resolve digest before promoting`, not `fixed` or `fixes`). Each commit
is a coherent, working unit — not a checkpoint of in-progress work. Breaking
changes to workflow inputs use the `!` marker or a `BREAKING CHANGE:` footer,
since those inputs are this repository's public API.
