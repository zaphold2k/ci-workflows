# Branch protection

The quality ratchet failing a run doesn't block a merge by itself — GitHub
still lets a pull request merge with a failing check unless the branch says
otherwise. This is the branch protection that makes the gate actually gate.

## What to require

On every branch a pull request can target (`main` in the simple model;
`develop` and `main` in the full model), require the `Verify (<language>)`
check — the job name `ci.yml` exposes — to pass before merging.

## Applying it with the API

Replace `OWNER/REPO` and the branch name. This requires admin on the
repository; `gh` picks up your existing authentication.

```bash
gh api repos/OWNER/REPO/branches/main/protection \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=Verify (node)' \
  -f 'enforce_admins=true' \
  -f 'required_pull_request_reviews[required_approving_review_count]=1' \
  -f 'restrictions='
```

Replace `Verify (node)` with the check name for your declared `language`
input (`Verify (go)`, `Verify (python)`, `Verify (make)`). Repeat for
`develop` in the full model — same command, different branch and the same
check name, since `ci.yml` reports under the same job name regardless of
which branch is being verified.

`required_status_checks[strict]=true` requires the branch to be up to date
with its target before merging, so the ratchet's baseline comparison is
actually comparing against what the PR will land on top of, not a stale
snapshot.

## Applying it with the UI

Settings → Branches → Add branch protection rule:

1. Branch name pattern: `main` (repeat for `develop` if using the full
   model).
2. Enable "Require status checks to pass before merging."
3. Enable "Require branches to be up to date before merging."
4. Search for and add `Verify (<language>)`.
5. Save.

## Verifying it's actually blocking

Open a pull request that deliberately regresses something the ratchet
checks — delete a test, for instance — against a protected branch. Confirm
the merge button is disabled with the check listed as required and failing,
then close the pull request without merging.

## A note on forks

A pull request from a fork runs with a read-only `GITHUB_TOKEN` by default,
which is why the ratchet's inability to comment never fails the run on its
own (see `docs/QUALITY-GATES.md`). The status check itself still reports
normally and still blocks the merge; only the PR comment is affected.
