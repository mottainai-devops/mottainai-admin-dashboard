# Mottainai Admin Dashboard — Deployment Protocol

**Effective: April 10, 2026**
**Applies to:** All developers working on `mottainai-admin-dashboard`

---

## The Rule: GitHub Is the Single Source of Truth

**All changes to the production server MUST go through GitHub.**

This means:

1. Write your code locally or in your development environment.
2. Commit and push to the `main` branch on GitHub.
3. The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically builds and deploys to the production server at `172.232.24.180`.
4. The deployment is complete when the GitHub Actions run shows a green checkmark.

**There is no Step 0 that says "SSH into the server and edit files directly."**

---

## Why This Rule Exists

On April 10, 2026, the backend developer deployed 9 tasks (geographic columns, RBAC, webhook health, geo backfill, port cleanup) **directly to the server** without pushing to GitHub. This created a dangerous split:

- The **production server** was running code that did not exist in GitHub.
- Any subsequent push from GitHub would have **overwritten the server's changes**.
- Any developer cloning the repo would have been working from **stale code**.
- There was no way to roll back, audit, or review the changes.

This is exactly the kind of situation that causes data loss and production outages.

---

## The Correct Workflow

```
Local development
      ↓
git commit -m "feat: describe what you did"
      ↓
git push origin main
      ↓
GitHub Actions runs automatically
      ↓
Build → Bundle → SCP to server → pm2 restart
      ↓
Production server is updated ✅
```

---

## What Happens If You Skip GitHub

- Your changes will be **overwritten** the next time anyone pushes to GitHub.
- The GitHub history will not reflect what is actually running on the server.
- Rollbacks become impossible — there is nothing to roll back to.
- Code reviews cannot happen on changes that were never committed.

---

## Hotfixes on the Server (Emergency Only)

If a critical production bug requires an immediate server-side fix that cannot wait for a full CI/CD cycle:

1. SSH into the server and apply the minimal fix.
2. **Immediately** replicate the exact same change in the GitHub repo and push.
3. Confirm the GitHub Actions deployment completes successfully.
4. The server-side hotfix is now superseded by the GitHub-deployed version.

If you skip Step 2 and 3, the hotfix will be lost on the next deployment.

---

## Checking Deployment Status

To verify a deployment completed successfully:

1. Go to `https://github.com/mottainai-devops/mottainai-admin-dashboard/actions`
2. Find the latest workflow run triggered by your push.
3. Confirm all steps show green checkmarks.
4. The final step "Deploy complete!" confirms the server was updated.

---

## Environment Variables

Environment variables live in `/var/www/mottainai-dashboard/.env` on the server. They are **not** committed to GitHub (and must never be). If you need to add or change an environment variable:

1. SSH into the server and update `.env` directly.
2. Run `pm2 restart mottainai-dashboard --update-env`.
3. Document the new variable in `.env.example` in the GitHub repo so other developers know it exists.

---

## Summary

| Action | Correct | Incorrect |
|---|---|---|
| Add a new feature | Commit → Push → CI/CD deploys | SSH → edit files on server |
| Fix a bug | Commit → Push → CI/CD deploys | SSH → edit files on server |
| Emergency hotfix | SSH fix → immediately commit & push | SSH fix → forget to push |
| Change env vars | SSH → edit .env → document in .env.example | Hardcode in source code |
| Roll back | `git revert` → Push → CI/CD deploys | SSH → manually undo changes |

---

*This protocol was established after an audit on April 10, 2026 found that production server state had diverged from the GitHub repository. All 9 tasks from the normalisation report were retroactively committed to GitHub to restore sync.*
