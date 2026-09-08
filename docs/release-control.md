# Production release control

This document applies after the release-control workflow has merged. It separates protected source integration from production release. It does not replace the Field Scheduler no-active-sync/no-next-run-within-90-minutes release rule.

## Owner configuration required before the first dispatch

An organisation repository administrator must configure the `production` GitHub environment **before any manual deployment is dispatched**. This workflow reference alone is not proof that environment controls are configured.

| Setting | Required value |
|---|---|
| Environment | `production` |
| Required reviewers | At least one owner-designated release reviewer with repository read access |
| Prevent self-review | Enabled |
| Administrator bypass | Disabled |
| Deployment branches | Selected branches and tags: `main` only |
| Environment secrets | No secret is added by this workflow change. Any future migration must be separately reviewed. |

GitHub supports required reviewers, self-review prevention, branch restrictions, and administrator-bypass controls for public repositories. A job that references an environment must satisfy its configured protection rules before it can run. [1] [2]

## Future production release sequence

1. Merge code through Core Green and an approving source review. This does not deploy.
2. Obtain a new human production-release GO for the exact `main` SHA.
3. Immediately check the Field Scheduler: no active sync and no next scheduled run within 90 minutes.
4. Manually dispatch **Deploy Admin Dashboard** from `main`, entering the exact current `main` SHA as `release_sha`.
5. A different designated reviewer approves the pending `production` environment deployment.
6. The existing build, host copy, restart, and health verification steps run.
7. Record only safe deployment metadata: workflow run ID, SHA, timestamps, scheduler-gate result, and health outcome.

If `main` moves after a release is prepared, the workflow fails its preflight. The release must be reconsidered for the new current `main` SHA; it does not deploy a stale commit.

## Bootstrap merge sequence

The release-control PR itself must use the interim workflow-pause procedure once: disable the old push-triggered deployment workflow under a fresh owner gate, merge through Core Green and source review, immediately re-enable the changed workflow, and verify that no deployment run occurred. Once the changed workflow is enabled on `main`, it is manual-dispatch-only.

## References

[1]: https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment "GitHub Docs: Managing environments for deployment"
[2]: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments "GitHub Docs: Deployments and environments"
