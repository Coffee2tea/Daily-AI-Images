---
description: How to correct deploy the Daily AI Images app to AI Builder Space
---

# Deployment Workflow

**CRITICAL:** Do NOT just `git push` to deploy. While it updates the repo, the actual service deployment on AI Builder Space is triggered via the `deploy_script.py`.

## Prerequisites
1. Ensure `.env` contains the correct `AI_BUILDER_TOKEN`.
2. Ensure `deploy-config.json` has `env_vars` populated with the production values (especially `AI_BUILDER_TOKEN`).

## Deployment Steps

1. **Update Version**: Bump `version` in `package.json` and `src/server/server.js` to track the deployment.
2. **Git Commit & Push**:
   ```powershell
   git add .
   git commit -m "Bump version and prepare deployment"
   git push origin main
   ```
3. **Trigger Deployment Script**:
   This script posts the configuration to `https://space.ai-builders.com/backend/v1/deployments`.
   **NOTE**: The script has been patched to use `verify=False` to avoid SSL errors.
   ```powershell
   // turbo
   python deploy_script.py
   ```
4. **Verify**:
   Check the output of the script. It should return a 200 OK status from the builder backend.

## Error Reminders
- **Error**: "SSL: CERTIFICATE_VERIFY_FAILED"
  - **Fix**: Ensure `requests.post(..., verify=False)` is used in `deploy_script.py`.
- **Error**: Deployment not updating on server
  - **Fix**: You probably only did `git push`. You MUST run `python deploy_script.py`.
