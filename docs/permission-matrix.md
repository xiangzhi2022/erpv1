# Permission Matrix

This project keeps the existing `users.role` and `user_permissions.permission_key` model, then maps the newer organization roles onto those permission keys.

| Role | Main Access | Hidden Fields |
| --- | --- | --- |
| boss / admin | All operational, finance, organization, and performance pages | None by default |
| production_manager | Orders, production tasks, worker performance, production performance, production employees | Profit fields unless granted `factory_profit_view` |
| worker | `/worker/tasks`, `/worker/wages` | Prices, costs, profit, wage rule id, unit price, other workers |
| dealer | `/dealer/orders`, `/dealer/orders/[id]` | Internal tasks, workers, wages, costs, profit, internal remarks |
| finance | Finance orders, wages, settlements, financial dashboards | Production task mutation unless separately granted |
| data_entry | Order basics | Prices, costs, profit, wages |

Shared field filtering lives in `src/lib/permission-utils.ts`.
