# Production Flow

Production tasks use `production_tasks.status` and log important transitions to `order_status_logs`.

Core flow:

`pending_assign -> assigned -> producing -> submitted -> completed`

Exception flow:

`submitted -> reworking`, `submitted -> abnormal`, or `submitted -> quality_failed`

Standard endpoints:

- `PATCH /api/production/tasks/:id/assign`
- `PATCH /api/production/tasks/:id/start`
- `PATCH /api/production/tasks/:id/submit`
- `PATCH /api/production/tasks/:id/review`
- `PATCH /api/production/tasks/:id/rework`
- `PATCH /api/production/tasks/:id/abnormal`

`/approve` remains as a compatibility endpoint. Parent order, space, and product status sync is handled by `syncOrderProgressFromTask`.
