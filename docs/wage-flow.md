# Wage Flow

Wage rules are configured in `/settings/wage-rules` and stored in `wage_rules`.

Worker task submission is the point where a wage record is generated:

1. Worker starts an assigned task.
2. Worker submits the task.
3. The system resolves a matching wage rule.
4. `calculateTaskWage(task, wageRule)` calculates the amount.
5. A `worker_wage_records` row is created or updated with `status = pending`.
6. Production management approves or rejects the submitted task.
7. Finance can move wages through `approved -> settled -> paid`.

Workers can see their own wage amount, but cannot see wage rule ids, unit prices, other workers, costs, or profit.
