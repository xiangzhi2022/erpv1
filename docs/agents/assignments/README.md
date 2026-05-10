# Agent 浠诲姟娲惧彂琛?

杩欎簺鏂囦欢鏄綋鍓嶉」鐩殑澶?agent 寮€鍙戜换鍔″崟銆傛瘡涓?Coze/Codex/Claude 绐楀彛鍙紩鐢ㄤ竴涓换鍔℃枃浠讹紝骞舵寜鍏朵腑鐨勮竟鐣屾墽琛屻€?

## 娲惧彂椤哄簭

1. 鍏堟淳鍙?`01-database-schema-alignment.md`銆?
2. 鍐嶆淳鍙?`02-db-client-cleanup.md`銆?
3. `03-orders-module.md`銆乣04-progress-workflow.md`銆乣05-workers-module.md`銆乣06-supplier-module.md` 鍜?`09` 鍒?`18` 鍙寜渚濊禆鍒嗘壒骞惰娲惧彂銆?
4. `19-dashboard-shell-sync-module.md` 鍜?`20-debug-ops-integrations.md` 鍙嫭绔嬫淳鍙戙€?
5. `07-test-coverage.md` 鍦ㄤ笟鍔′换鍔″熀鏈畬鎴愬悗娲惧彂銆?
6. `08-review-and-github.md` 鏈€鍚庢淳鍙戯紝璐熻矗闆嗘垚妫€鏌ュ拰 PR 浜や粯銆?

## 浠诲姟绱㈠紩

| 鏂囦欢 | 寤鸿鍒嗘敮 | Worker | 瑕嗙洊鑼冨洿 |
| --- | --- | --- | --- |
| `01-database-schema-alignment.md` | `codex-db-schema-alignment` | `database-agent` | Drizzle schema銆乺elations銆佸垵濮嬪寲鑴氭湰 |
| `02-db-client-cleanup.md` | `codex-db-client-cleanup` | `backend-agent` | Supabase client銆佺幆澧冨彉閲忋€佹暟鎹簱璁块棶 |
| `03-orders-module.md` | `codex-orders-module-hardening` | `backend-agent` | 璁㈠崟椤甸潰涓庤鍗?API |
| `04-progress-workflow.md` | `codex-progress-workflow` | `backend-agent` | 鐢熶骇杩涘害宸ュ崟銆佷笂鎶ャ€佹棩蹇?|
| `05-workers-module.md` | `codex-workers-module` | `backend-agent` | 宸ヤ汉妗ｆ绠＄悊 |
| `06-supplier-module.md` | `codex-supplier-module` | `backend-agent` | 渚涘簲鍟嗘。妗堜笌渚涘簲鍟嗚鍗?|
| `07-test-coverage.md` | `codex-test-coverage-core-flows` | `test-agent` | 鏍稿績娴佺▼娴嬭瘯琛ラ綈 |
| `08-review-and-github.md` | `codex-release-integration` | `review-agent + github-agent` | 鏈€缁?review銆侀泦鎴愩€丳R |
| `09-dealer-module.md` | `codex-dealer-module` | `backend-agent` | 缁忛攢鍟嗛〉闈笌 API |
| `10-factory-workshops-module.md` | `codex-factory-workshops-module` | `backend-agent` | 宸ュ巶杞﹂棿绠＄悊 |
| `11-factory-portal-module.md` | `codex-factory-portal-module` | `backend-agent` | 宸ュ巶绔鍗曟睜涓庝换鍔＄粺璁?|
| `12-worker-portal-module.md` | `codex-worker-portal-module` | `backend-agent` | 宸ヤ汉绔换鍔′笌涓婃姤 |
| `13-tasks-categories-notifications-module.md` | `codex-tasks-categories-notifications` | `backend-agent` | 浠诲姟銆佸垎绫汇€侀€氱煡 |
| `14-settings-module.md` | `codex-settings-module` | `backend-agent` | 璁剧疆涓績 |
| `15-auth-module.md` | `codex-auth-module` | `backend-agent` | 璁よ瘉銆侀獙璇佺爜銆丱Auth銆佸瘑鐮侀噸缃?|
| `16-dashboard-reporting-module.md` | `codex-dashboard-reporting` | `backend-agent` | 浠〃鐩樹笌缁熻鎶ヨ〃 |
| `17-operational-views-module.md` | `codex-operational-views` | `frontend-agent` | 鐪嬫澘銆佽储鍔°€佸彂璐ц交閲忚鍥?|
| `18-customers-factories-shared-api.md` | `codex-shared-customers-factories-api` | `backend-agent` | 瀹㈡埛涓庡伐鍘傚叡浜?API |
| `19-dashboard-shell-sync-module.md` | `codex-dashboard-shell-sync` | `frontend-agent` | 鏃?dashboard 鍒嗙粍涓庡悓姝ラ〉 |
| `20-debug-ops-integrations.md` | `codex-debug-ops-integrations` | `backend-agent` | debug/test/ppt-fetch 杈呭姪 API |

## Worker 鍚姩瑙勫垯

- 姣忎釜 worker 鍏堝悓姝ユ渶鏂?`main`锛屽啀鍒涘缓鐙珛鍒嗘敮銆?
- 濡傛灉宸ヤ綔鍖轰笉骞插噣锛屽仠姝㈠苟姹囨姤锛屼笉瑕佽鐩栧凡鏈夋敼鍔ㄣ€?
- 姣忎釜 worker 鍙彁浜や换鍔¤寖鍥村唴鏂囦欢銆?
- 姣忎釜 worker 鎺ㄩ€佸埌鑷繁鐨?`origin/<branch>`锛屼笉瑕佸悎骞?`main`銆?

## 褰撳墠鍩虹嚎

- `pnpm ts-check` 褰撳墠閫氳繃銆?
- `pnpm test` 褰撳墠閫氳繃锛? 涓祴璇曟枃浠讹紝33 涓祴璇曘€?
- 褰撳墠宸ヤ綔鍖哄凡鏈夋湭鎻愪氦鏀瑰姩銆俉orker 涓嶈鍥炴粴銆佷笉瑕嗙洊銆佷笉鏍煎紡鍖栨棤鍏虫枃浠躲€?

## 閫氱敤浜や粯鏍煎紡

姣忎釜 worker 瀹屾垚鍚庡彧杩斿洖锛?

```text
## 淇敼鏂囦欢
- ...

## 瀹炵幇璇存槑
- ...

## 楠岃瘉
- 宸茶繍琛? ...
- 鏈繍琛屽強鍘熷洜: ...

## 椋庨櫓
- ...
```

## 纭鍒?

- 鍙兘浣跨敤 `pnpm`銆?
- 涓嶈浣跨敤 `npm` 鎴?`yarn`銆?
- 涓嶈浣跨敤闅愬紡 `any` 鎴?`as any`銆?
- 涓嶈澶氫釜 worker 鍚屾椂淇敼鍚屼竴涓枃浠躲€?
- 涓嶈鎻愪氦 `.env` 鎴栧瘑閽ャ€?
- Worker 涓嶅仛鏈€缁堝悎骞讹紝鏈€缁堥泦鎴愮敱 review/github agent 澶勭悊銆?

## Smoke Fix Dispatch - 2026-05-10

Source report: `docs/review/SMOKE-TEST-RESULTS.md`

These tasks are follow-up smoke blockers discovered after the original 01-20 integration. Dispatch them from `origin/main` into independent branches. Do not reuse the removed `21-lint-blockers.md` task.

### Dispatch order

1. Dispatch `21-smoke-dashboard-shell.md` first to unblock page rendering failures.
2. Dispatch `22-smoke-auth-session.md` second because order and progress write flows depend on normal login sessions.
3. Dispatch `23-smoke-orders-flow.md` after Task 22, or in parallel only if the worker can test with an equivalent authenticated session.
4. Dispatch `24-smoke-progress-flow.md` after Task 22, or in parallel only if the worker can test with a UUID-compatible authenticated session.
5. Dispatch `25-smoke-portals-routing.md` in parallel with Tasks 23-24.
6. Dispatch `26-smoke-tasks-notifications-api.md` in parallel with Tasks 23-24 after auth expectations are clear.

### Smoke task index

| File | Suggested Branch | Worker | Scope |
| --- | --- | --- | --- |
| `21-smoke-dashboard-shell.md` | `codex/smoke-dashboard-shell` | `frontend-agent` | SidebarProvider/runtime 500s for dashboard, supplier, settings, factory |
| `22-smoke-auth-session.md` | `codex/smoke-auth-session` | `backend-agent` | `auth_session` API auth unification and UUID-compatible demo identity |
| `23-smoke-orders-flow.md` | `codex/smoke-orders-flow` | `backend-agent` | Order creation schema mismatch and status flow |
| `24-smoke-progress-flow.md` | `codex/smoke-progress-flow` | `backend-agent` | Work order creation and progress report UUID failures |
| `25-smoke-portals-routing.md` | `codex/smoke-portals-routing` | `frontend-agent` | Factory and worker portal 404 routing |
| `26-smoke-tasks-notifications-api.md` | `codex/smoke-tasks-notifications-api` | `backend-agent` | Categories, tasks, notifications API 500s |
