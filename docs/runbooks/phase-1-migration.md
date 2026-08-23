# Phase 1 production migration runbook

> Status: **template only — not executed and not rehearsed**. Check boxes and evidence fields below are intentionally blank. Completing this document does not authorize or perform any production operation.

This runbook upgrades Qingya ERP while preserving the five existing v2 migrations and their data. The production Supabase project reference is `jfcsbwdawvsxnmovwlgl`. Stop immediately if any resolved target differs from the approved target or if an isolated target resolves to that production reference.

## Non-negotiable safety rules

- Every external action class requires its own recorded authorization. An authorization for a backup, migration batch, Auth setting, Netlify variable, or deploy cannot authorize any other action class. Every production **write** command or operation requires its own row; a backup authorization may cover only the three exact read-only dumps listed below.
- The production backup is a separately authorized external operation even though the commands are read-only.
- Never run `supabase db reset` against a linked or production target. Never use `DROP ... CASCADE`, delete migration-history rows, run a down migration, or restore a dump over production.
- Apply production schema changes only through the reviewed Supabase migration mechanism. Do not run legacy `scripts/init-*.sql` files or paste migration SQL into the Dashboard.
- Do not enable shell tracing (`set -x`). Do not print or copy into this document any password, Secret Key, access token, cookie, or credential-bearing database connection string. Use an approved protected CLI profile, an external libpq service file, and protected environment injection.
- Dumps, ID inventories, and logs are sensitive. Keep them outside the repository, mode `0600`, and do not upload them to Git, CI artifacts, tickets, or chat.
- Any failed gate means **stop**. Do not “fix forward” in production without a new reviewed migration and a separate authorization.

## Roles and authorization record

At least two people participate: the operator runs commands; the reviewer checks target identity, migration content, output, and stop/go decisions. Record an immutable ticket or approval identifier, not a pasted conversation.

| Operation | Exact scope | Separate authorization ID | Operator | Reviewer | UTC time | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Read production inventory | Migration history and advisors only |  |  |  |  | Not authorized |
| Create production backup | Schema, roles/grants, data |  |  |  |  | Not authorized |
| Enter maintenance/read-only mode | Exact application entry points |  |  |  |  | Not authorized |
| Apply production migration batch | Exact migration version list |  |  |  |  | Not authorized |
| Change Supabase Auth settings | Exact setting and before/after value |  |  |  |  | Not authorized |
| Change Netlify environment | Exact variable names and context |  |  |  |  | Not authorized |
| Deploy production application | Exact reviewed commit |  |  |  |  | Not authorized |

If an operation is split into multiple production writes, add one row and obtain one authorization for **each** write. A migration authorization must name every migration version in the single approved `db push` batch; adding a migration invalidates that authorization.

## 1. Prepare a clean reviewed release

Run from the repository root. These commands are local and read-only.

```bash
set -eu
test "$(git rev-parse --show-toplevel)" = "$PWD"
test -z "$(git status --porcelain)"
git branch --show-current
git rev-parse HEAD
node --version
pnpm --version
pnpm exec supabase --version
find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort
git diff --check
```

Record the reviewed branch, commit, Node version, pnpm version, Supabase CLI version, and migration list in the evidence section. Abort on a dirty tree, an unreviewed commit, or unexpected migration file.

The five preserved starting migration versions must be exactly:

```text
20260817083043
20260817092158
20260817105633
20260817152357
20260817180901
```

Run the local application and clean-database gates before any production access. The reset and final `stop --no-backup` destroy the selected local Supabase volumes. Use only a disposable local instance and set `ALLOW_DESTRUCTIVE_LOCAL_RESET=1` explicitly for this run; never set it globally or on a workstation whose local data must be retained.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm ts-check
pnpm test
pnpm build
: "${ALLOW_DESTRUCTIVE_LOCAL_RESET:?Explicitly authorize reset of the disposable local Supabase instance}"
test "$ALLOW_DESTRUCTIVE_LOCAL_RESET" = '1'
pnpm db:start
pnpm db:reset
pnpm db:test
pnpm db:lint
pnpm db:types:check
```

`pnpm db:reset` above is permitted only for the disposable local Supabase instance selected by the repository's `--local` script. It is forbidden for linked, staging-with-preserved-data, and production targets.

## 2. Create the production backup outside the repository

Do not begin until the **Create production backup** row has a valid separate authorization. Before running the block below, the operator must explicitly export a new absolute `ERP_BACKUP_DIR`. The approved root is `/var/backups/qingya-erp/phase-1`; the recommended value shape is `/var/backups/qingya-erp/phase-1/<YYYYMMDDTHHMMSSZ>`, using the actual UTC run ID. Do not use the repository, `/tmp`, `/var/tmp`, or a user home directory.

```bash
set -eu
set +x
umask 077
: "${ERP_BACKUP_DIR:?Set an explicit absolute backup directory under /var/backups/qingya-erp/phase-1}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
OPERATOR_HOME="$(getent passwd "$(id -u)" | cut -d: -f6)"
RESOLVED_BACKUP_DIR="$(realpath -m -- "$ERP_BACKUP_DIR")"
test "$RESOLVED_BACKUP_DIR" = "$ERP_BACKUP_DIR"
case "$RESOLVED_BACKUP_DIR" in
  /var/backups/qingya-erp/phase-1/*) ;;
  *) echo 'Backup path is outside the approved absolute root' >&2; exit 1 ;;
esac
case "$RESOLVED_BACKUP_DIR/" in
  /tmp/*|/var/tmp/*|"$REPO_ROOT"/*|"$OPERATOR_HOME"/*)
    echo 'Backup path must not be temporary, in the repository, or in a user home' >&2
    exit 1
    ;;
esac
test ! -e "$RESOLVED_BACKUP_DIR"
install -d -m 0700 "$RESOLVED_BACKUP_DIR"
test "$(realpath "$RESOLVED_BACKUP_DIR")" = "$RESOLVED_BACKUP_DIR"
printf '%s\n' "$RESOLVED_BACKUP_DIR"
```

The operator must record the resolved absolute directory printed by `realpath`. Use an authenticated Supabase CLI profile configured outside the repository. Do not pass a password or connection URL on the command line.

Remote dump commands use the CLI's linked-project context. If `supabase/.temp/project-ref` is absent or different, stop. Only within the already authorized production-backup operation, use the protected profile to link explicitly:

```bash
set +x
pnpm exec supabase link --project-ref jfcsbwdawvsxnmovwlgl
```

`supabase link` creates ignored local CLI metadata and establishes the target context; it is not authorization for a production database write. It must not print or receive a password on the command line. Validate the local target marker immediately before the dump group:

```bash
test -f supabase/.temp/project-ref
test "$(tr -d '\r\n' < supabase/.temp/project-ref)" = 'jfcsbwdawvsxnmovwlgl'
pnpm exec supabase db dump --linked --file "$ERP_BACKUP_DIR/schema.sql"
pnpm exec supabase db dump --linked --role-only --file "$ERP_BACKUP_DIR/roles.sql"
pnpm exec supabase db dump --linked --data-only --use-copy --file "$ERP_BACKUP_DIR/data.sql"
chmod 0600 "$ERP_BACKUP_DIR/schema.sql" "$ERP_BACKUP_DIR/roles.sql" "$ERP_BACKUP_DIR/data.sql"
(
  cd "$ERP_BACKUP_DIR"
  sha256sum schema.sql roles.sql data.sql > SHA256SUMS
  chmod 0600 SHA256SUMS
  sha256sum --check SHA256SUMS
)
```

All three checksum lines must report `OK`. `roles.sql` can contain privileged role metadata and must be handled as a secret-bearing backup even when it contains no plaintext password. A successful dump is not yet a recoverable backup; isolated restore verification in the next section is mandatory.

## 3. Restore and upgrade only an isolated rehearsal database

Provision a dedicated, disposable non-production Supabase project or branch. Use its standard `postgres` database; do not create an ordinary PostgreSQL database that lacks Supabase Auth, Storage, extensions, roles, and platform objects. It must have a distinct 20-character project ref and no replication link or shared storage with production.

In one protected shell, inject the non-production project ref, a passwordless database URL, and password separately. `TARGET_DATABASE_URL` may contain host, port, username, database name, and non-secret connection options, but never a password or token. It must select `/postgres` and bind the selected ref through either the exact direct hostname or the pooler username. This validation does not print either credential.

```bash
set -eu
set +x
: "${REHEARSAL_PROJECT_REF:?Set the dedicated non-production project ref}"
: "${TARGET_DATABASE_URL:?Set the passwordless rehearsal database URL}"
: "${SUPABASE_DB_PASSWORD:?Inject the rehearsal database password}"
test "$REHEARSAL_PROJECT_REF" != 'jfcsbwdawvsxnmovwlgl'
export TARGET_DATABASE_URL REHEARSAL_PROJECT_REF SUPABASE_DB_PASSWORD
export PGPASSWORD="$SUPABASE_DB_PASSWORD"
node <<'NODE'
const ref = process.env.REHEARSAL_PROJECT_REF;
const url = new URL(process.env.TARGET_DATABASE_URL);
const userParts = decodeURIComponent(url.username).split('.');
const direct = url.hostname === `db.${ref}.supabase.co`;
const pooler = url.hostname.endsWith('.pooler.supabase.com') && userParts.includes(ref);
if (!/^[a-z0-9]{20}$/.test(ref) || !['postgres:', 'postgresql:'].includes(url.protocol) || url.password || url.pathname !== '/postgres' || (!direct && !pooler)) {
  throw new Error('Rehearsal database URL is not bound to the selected non-production project');
}
NODE
```

During initial provisioning only, set the marker on this reviewed non-production target. Then define the fail-closed identity check used immediately before every restore, migration-history repair, or migration push. It verifies the same URL, database name, marker, and a nonempty server address.

```bash
BOOTSTRAP_IDENTITY="$(psql "$TARGET_DATABASE_URL" -X -Atqc \
  "select current_database() || '|' || coalesce(inet_server_addr()::text, '')")"
case "$BOOTSTRAP_IDENTITY" in
  postgres\|?*) ;;
  *) echo 'Initial rehearsal target identity check failed' >&2; exit 1 ;;
esac
psql "$TARGET_DATABASE_URL" -X --set=ON_ERROR_STOP=on \
  -c "ALTER DATABASE postgres SET app.environment = 'rehearsal'"
verify_rehearsal_target() {
  TARGET_IDENTITY="$(psql "$TARGET_DATABASE_URL" -X -Atqc \
    "select current_database() || '|' || coalesce(current_setting('app.environment', true), '') || '|' || coalesce(inet_server_addr()::text, '')")"
  case "$TARGET_IDENTITY" in
    postgres\|rehearsal\|?*) ;;
    *) echo 'Rehearsal target identity check failed' >&2; return 1 ;;
  esac
}
verify_rehearsal_target
```

If the shell is replaced, re-run the protected initialization and function definition before continuing. Verify checksums immediately before restore, then restore into this isolated target. Do not add `--clean`, `--if-exists`, or any drop option.

```bash
(
  cd "$ERP_BACKUP_DIR"
  sha256sum --check SHA256SUMS
)
verify_rehearsal_target
psql "$TARGET_DATABASE_URL" -X --set=ON_ERROR_STOP=on --file "$ERP_BACKUP_DIR/roles.sql"
verify_rehearsal_target
psql "$TARGET_DATABASE_URL" -X --set=ON_ERROR_STOP=on --file "$ERP_BACKUP_DIR/schema.sql"
verify_rehearsal_target
psql "$TARGET_DATABASE_URL" -X --set=ON_ERROR_STOP=on --file "$ERP_BACKUP_DIR/data.sql"
```

If role creation needs cluster-level privileges, perform it only inside the disposable isolated cluster. A role collision or restore warning is a failed restore until reviewed; do not ignore it.

Capture protected, sorted ID inventories before applying new migrations. These files contain identifiers and stay in the backup directory; evidence records only their counts and SHA-256 values.

```bash
verify_rehearsal_target
psql "$TARGET_DATABASE_URL" -X -Atqc 'select id from public.enterprises order by id' > "$ERP_BACKUP_DIR/before-enterprises.ids"
psql "$TARGET_DATABASE_URL" -X -Atqc 'select id from public.enterprise_memberships order by id' > "$ERP_BACKUP_DIR/before-memberships.ids"
psql "$TARGET_DATABASE_URL" -X -Atqc 'select id from public.api_idempotency_keys order by id' > "$ERP_BACKUP_DIR/before-idempotency.ids"
psql "$TARGET_DATABASE_URL" -X -Atqc 'select id from public.audit_events order by id' > "$ERP_BACKUP_DIR/before-audit.ids"
psql "$TARGET_DATABASE_URL" -X -Atqc 'select id from app_private.security_events order by id' > "$ERP_BACKUP_DIR/before-security-events.ids"
chmod 0600 "$ERP_BACKUP_DIR"/before-*.ids
wc -l "$ERP_BACKUP_DIR"/before-*.ids > "$ERP_BACKUP_DIR/before-counts.txt"
sha256sum "$ERP_BACKUP_DIR"/before-*.ids > "$ERP_BACKUP_DIR/before-id-sha256.txt"
chmod 0600 "$ERP_BACKUP_DIR/before-counts.txt" "$ERP_BACKUP_DIR/before-id-sha256.txt"
```

Mark the five existing migration versions and preview the pending set. The repair is a write, so run the same URL identity check immediately before it.

```bash
verify_rehearsal_target
pnpm exec supabase migration repair \
  20260817083043 20260817092158 20260817105633 20260817152357 20260817180901 \
  --status applied --db-url "$TARGET_DATABASE_URL"
pnpm exec supabase migration list --db-url "$TARGET_DATABASE_URL"
pnpm exec supabase db push --db-url "$TARGET_DATABASE_URL" --skip-vault --dry-run
```

The reviewer must compare the dry-run list with the reviewed migration inventory. If it includes one of the five baseline migrations, excludes a new migration, or includes any unexpected version, stop. Apply only to the isolated rehearsal database:

```bash
verify_rehearsal_target
pnpm exec supabase db push --db-url "$TARGET_DATABASE_URL" --skip-vault
pnpm exec supabase migration list --db-url "$TARGET_DATABASE_URL"
```

Capture the same inventories and require byte-for-byte equality. This verifies both row counts and ID sets remained unchanged.

```bash
verify_rehearsal_target
psql "$TARGET_DATABASE_URL" -X -Atqc 'select id from public.enterprises order by id' > "$ERP_BACKUP_DIR/after-enterprises.ids"
psql "$TARGET_DATABASE_URL" -X -Atqc 'select id from public.enterprise_memberships order by id' > "$ERP_BACKUP_DIR/after-memberships.ids"
psql "$TARGET_DATABASE_URL" -X -Atqc 'select id from public.api_idempotency_keys order by id' > "$ERP_BACKUP_DIR/after-idempotency.ids"
psql "$TARGET_DATABASE_URL" -X -Atqc 'select id from public.audit_events order by id' > "$ERP_BACKUP_DIR/after-audit.ids"
psql "$TARGET_DATABASE_URL" -X -Atqc 'select id from app_private.security_events order by id' > "$ERP_BACKUP_DIR/after-security-events.ids"
chmod 0600 "$ERP_BACKUP_DIR"/after-*.ids
wc -l "$ERP_BACKUP_DIR"/after-*.ids > "$ERP_BACKUP_DIR/after-counts.txt"
sha256sum "$ERP_BACKUP_DIR"/after-*.ids > "$ERP_BACKUP_DIR/after-id-sha256.txt"
chmod 0600 "$ERP_BACKUP_DIR/after-counts.txt" "$ERP_BACKUP_DIR/after-id-sha256.txt"
for name in enterprises memberships idempotency audit security-events; do
  cmp "$ERP_BACKUP_DIR/before-${name}.ids" "$ERP_BACKUP_DIR/after-${name}.ids"
done
```

Any `cmp` output or nonzero exit is a hard stop. Investigate locally, create a reviewed corrective migration, create a new backup/rehearsal run, and obtain new production authorization.

## 4. Run both full database gates

The clean-database gate from section 1 and the restored-snapshot gate must both pass. For a non-production ref, `verify:production-readiness` runs the clean local gate plus target pgTAP, database lint, generated-type comparison, exact migration history, and advisors. It requires the same `TARGET_DATABASE_URL` and marker used above and never applies target migrations. It refuses the production ref as a full gate. The application build must use the exact same non-production project URL and a non-secret publishable/legacy anon key; this prevents production browser configuration from being combined with rehearsal database evidence.

```bash
: "${REHEARSAL_PROJECT_REF:?Set the isolated non-production Supabase project ref}"
: "${ALLOW_DESTRUCTIVE_LOCAL_RESET:?Explicitly authorize reset of the disposable local Supabase instance}"
: "${NEXT_PUBLIC_SUPABASE_URL:?Set the selected rehearsal project URL}"
: "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:?Inject the selected project's publishable key}"
test "$REHEARSAL_PROJECT_REF" != 'jfcsbwdawvsxnmovwlgl'
test "$ALLOW_DESTRUCTIVE_LOCAL_RESET" = '1'
test "$NEXT_PUBLIC_SUPABASE_URL" = "https://${REHEARSAL_PROJECT_REF}.supabase.co"
verify_rehearsal_target
SUPABASE_TARGET_PROJECT_REF="$REHEARSAL_PROJECT_REF" \
  TARGET_DATABASE_URL="$TARGET_DATABASE_URL" \
  pnpm verify:production-readiness
```

The verifier must show that target pgTAP, lint, and type comparison ran with `--db-url "$TARGET_DATABASE_URL"`. Record commands, exit codes, and sanitized output; any skipped target command is a failed gate.

Also exercise Auth, enterprise selection, direct-ID cross-enterprise denials, categories, tasks, notifications, rate-limit responses, error/request-ID behavior, and security headers with dedicated non-production test identities. Do not record emails, phone numbers, tokens, cookies, UUIDs, or business rows.

## 5. Reviewer checkpoint and production dry run

Before any production write, the reviewer confirms:

- [ ] backup absolute path and `SHA256SUMS` verification recorded;
- [ ] isolated restore succeeded without ignored warnings;
- [ ] all five before/after counts and ID sets match;
- [ ] clean and preserved-snapshot gates passed;
- [ ] migration SQL contains no destructive operation or unreviewed privilege expansion;
- [ ] grants, RLS, functions, triggers, and advisor results were reviewed;
- [ ] Deploy Preview variables cannot reference the production project;
- [ ] the rollback runbook has a reviewed prior application artifact and entry-point disable procedure;
- [ ] the exact migration version batch has separate production authorization.

With separate authorization for **Read production inventory**, inspect the explicitly selected production target and save only sanitized output. The full readiness verifier is intentionally not run here because its exact-history check passes only after the reviewed pending migrations are applied:

```bash
test -f supabase/.temp/project-ref
test "$(tr -d '\r\n' < supabase/.temp/project-ref)" = 'jfcsbwdawvsxnmovwlgl'
pnpm exec supabase migration list --linked
pnpm exec supabase db push --linked --skip-vault --dry-run
```

The dry run must exactly match the separately authorized migration batch. Stop on any difference.

## 6. Apply the authorized production migration batch

This section is a production write. Do not run it unless the **Apply production migration batch** row names the exact dry-run versions and is approved. Reconfirm the project reference in the Supabase CLI profile without displaying credentials. One command is one authorized write operation:

```bash
test -f supabase/.temp/project-ref
test "$(tr -d '\r\n' < supabase/.temp/project-ref)" = 'jfcsbwdawvsxnmovwlgl'
pnpm exec supabase db push --linked --skip-vault
```

Do not add `--include-all`, `--include-seed`, `--include-roles`, or interactive fixes. Do not run a second write command under the same authorization. If the command fails or is partially applied, stop, preserve sanitized output, inspect migration history read-only, and follow the forward-only rollback runbook.

Post-migration production evidence is read-only and requires its recorded production-read authorization. In production mode the verifier performs only the three Management API GET requests for migration history and advisors; it does not run database/application gates and its output is not a readiness or deployment approval:

```bash
test -f supabase/.temp/project-ref
test "$(tr -d '\r\n' < supabase/.temp/project-ref)" = 'jfcsbwdawvsxnmovwlgl'
pnpm exec supabase migration list --linked
SUPABASE_TARGET_PROJECT_REF=jfcsbwdawvsxnmovwlgl \
  ALLOW_PRODUCTION_READ_ONLY_CHECKS=1 \
  pnpm verify:production-readiness
```

Supabase Auth changes, Netlify environment changes, maintenance-mode changes, and production deployment are separate production writes. Execute each only after its own row contains exact scope and authorization. Follow `docs/auth-production-gate.md` for Auth/redirect and environment context rules.

## 7. Evidence record

Keep sensitive raw output in the approved backup/evidence store. Put only sanitized summaries in review records.

| Evidence | Location or sanitized result | Reviewer | UTC time |
| --- | --- | --- | --- |
| Reviewed commit and migration list | Not recorded |  |  |
| Resolved absolute backup directory | Not recorded |  |  |
| `SHA256SUMS` location and check result | Not recorded |  |  |
| Isolated restore result | Not run |  |  |
| Before/after row counts | Not run |  |  |
| Before/after ID-set checksum comparison | Not run |  |  |
| Clean database pgTAP/lint/type drift | Not run |  |  |
| Preserved snapshot pgTAP/lint/type drift | Not run |  |  |
| Application lint/type/test/build | Not run |  |  |
| Schema diff and grants/RLS review | Not run |  |  |
| Supabase security/performance advisors | Not run |  |  |
| Auth flow results | Not run |  |  |
| Cross-enterprise denial results | Not run |  |  |
| Production migration history after apply | Not run |  |  |

Never attach backup contents, identifier lists, PII, access tokens, database URLs, API keys, Secret Keys, cookies, or environment dumps. This table must remain “Not run/Not recorded” until an operator supplies real evidence from an authorized rehearsal or rollout.
