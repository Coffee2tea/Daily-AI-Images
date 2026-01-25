# Security Policy

## Secret Management

**CRITICAL RULE: NEVER COMMIT SECRETS TO VERSION CONTROL.**

1.  **Environment Variables**: Always use `.env` files for:
    *   API Keys (Google, OpenAI, etc.)
    *   Database Credentials
    *   Email Passwords/App Passwords
    *   Private Tokens

2.  **Git Ignore**:
    *   Ensure `.env` is always in `.gitignore`.
    *   Ensure any temporary files containing secrets (like `deployment_payload.json`) are in `.gitignore`.

3.  **Pre-Commit Check**:
    *   Before committing, verify that no new files contain hardcoded secrets.
    *   Use placeholders (e.g., `YOUR_API_KEY`) in example files.

## Leaked Secret Remediation
If a secret is leaked:
1.  **Revoke** the secret immediately at the provider (Google Cloud, AWS, etc.).
2.  **Rotate** the key (generate a new one).
3.  **Remove** the secret from the codebase and history.
