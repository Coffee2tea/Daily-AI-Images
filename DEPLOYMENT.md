# Deployment Guide

**IMPORTANT**: This project is deployed to **AI Builder Space**. Deployment is a two-step process: Git Push + API Trigger.

## 1. Prerequisites
- **Python**: Required to run the deployment script.
- **AI Builder Token**: Must be set in `.env` as `AI_BUILDER_TOKEN`.

## 2. Configuration
The deployment configuration is stored in `deploy-config.json`.
**Critical:** Ensure `env_vars` in this file are up-to-date locally before deploying, as they are sent to the server.
```json
{
    "repo_url": "https://github.com/Coffee2tea/Daily-AI-Images",
    "env_vars": {
        "AI_BUILDER_TOKEN": "..."
    }
}
```

## 3. Deployment Steps

### Step 1: Commit and Push Code
Ensure all your code changes are committed and pushed to GitHub.
```bash
git add .
git commit -m "Your feature message"
git push origin main
```

### Step 2: Trigger Deployment (The "Real" Deploy)
Run the Python script to notify AI Builder Space to pull the new code and rebuild.
```bash
python deploy_script.py
```
*Note: This script handles authentication and configuration injection.*

## 4. Troubleshooting
- **SSL Certificate Errors**: The `deploy_script.py` has `verify=False` set to bypass strict SSL checks on the builder API. Do not remove this unless certificates are fixed.
- **Dependencies**: The `Dockerfile` has been optimized. If the build fails, check `Dockerfile` for missing system dependencies (though we removed most to slim it down).
