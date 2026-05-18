# Dealer Visibility

Dealer order pages expose only external progress.

Allowed dealer fields:

- Order number
- Customer name and basic delivery-facing customer information
- External status
- Production progress label
- Expected ship date
- Shipping status
- Logistics placeholder or logistics data when available
- Public remark

Hidden fields:

- Internal production task tree
- Worker names and worker ids
- Wage records, wage rule ids, unit prices, and wage amounts
- Sale/cost/profit internals not explicitly intended for dealer accounting
- Internal remarks, finance remarks, production internal notes, supplier prices

Internal status is mapped through `mapInternalStatusToDealerStatus`.
