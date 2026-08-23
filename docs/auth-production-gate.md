# Supabase Auth production gate

This checklist is intentionally manual. Repository code must not change the
production Auth configuration or store provider secrets.

## Required dashboard configuration

- Site URL: `https://qingya-erp-163.netlify.app`
- Redirect allowlist:
  - `https://qingya-erp-163.netlify.app/auth/confirm`
  - `https://**--qingya-erp-163.netlify.app/auth/confirm`
  - `http://localhost:5000/auth/confirm`
- Enable only the identity channels actually operated by the business:
  email/password, phone/password or OTP, GitHub, and Google.
- Configure GitHub/Google client secrets only in Supabase and the provider
  consoles. The application does not implement a custom WeChat OAuth exchange.
- Enable leaked-password protection when available for the project plan.
- Confirm Auth rate limits and SMTP/SMS delivery settings before inviting users.
- If CAPTCHA is required, configure a Supabase-supported hCaptcha or Turnstile
  provider and pass its token to Auth. Do not restore the removed process-memory
  CAPTCHA route.
- `SKIP_CAPTCHA` must be absent from every production and deploy-preview
  environment.

## Required application secrets

- Generate an independent, high-entropy `RATE_LIMIT_PEPPER` and store it as a
  Netlify protected environment variable for production and deploy previews.
- Never reuse a Supabase key as the pepper, expose it to the browser, print it in
  build/runtime logs, or commit its real value. `.env.example` contains only a
  non-secret placeholder.
- Treat the pepper as a hard release gate: authentication, uploads, organization
  switching, and critical mutations intentionally fail closed with HTTP 503 when
  it is absent or invalid.
- Verify only that the variable exists in each required Netlify deploy context;
  do not retrieve or echo its value during release checks.

## Legacy identity activation

1. Run `pnpm legacy-auth:report` against a reviewed read-only snapshot. The
   report emits counts only and never prints email addresses, phone numbers,
   password fields, tokens, or Secret Keys.
2. Resolve duplicate and missing contacts before inviting anyone.
3. Create or invite the identity through Supabase Auth. Existing password hashes
   are never copied into Auth.
4. Record the stable source ID and new Auth UUID in
   `app_private.legacy_identity_mappings`; do not put password material in that
   table.
5. Activate the corresponding enterprise membership only after the person has
   verified the identity or completed a password reset.
6. Keep legacy password columns read-only until migration acceptance, then remove
   them in a separately reviewed migration.

Do not run activation against production without a backup, an approved user
batch, delivery-provider readiness, and an explicit maintenance window.
