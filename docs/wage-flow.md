# Wage Flow

Factory wage management is configured in `/settings/wage-rules` and stored in `wage_rules`.
Only factory ERP admins and factory bosses can maintain rules. Suppliers and dealers do not use factory wage rules.

Rule matching is tenant-scoped and ordered by specificity:

1. Worker personal rule
2. Position rule
3. Company-wide rule

The same rule model supports board area wages, door set wages, piece/meter wages, fixed special-piece wages, and an optional structured extra amount.

Worker task submission is the point where a wage record is generated:

1. Worker starts an assigned task.
2. Worker submits the split task.
3. The system resolves a matching wage rule.
4. `calculateTaskWage(task, wageRule)` calculates the amount.
5. A `worker_wage_records` row is created or updated with `status = pending`.
6. Production management approves or rejects the submitted task.
7. Finance can move wages through `approved -> settled -> paid`.

Workers can see their own wage amount, but cannot see wage rule ids, unit prices, other workers, costs, or profit.
