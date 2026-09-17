# LeadNet Usage Enforcement Requirements

LeadNet Speed To Lead activation is intentionally blocked in this website checkout until the companion LeadNet application supplies trustworthy SMS usage controls.

Required companion-app capabilities:

- Verified customer/account mapping between the marketing order, Stripe customer, LeadNet tenant, and messaging provider account.
- Provider message IDs for inbound and outbound SMS.
- Provider-confirmed segment counts for inbound and outbound SMS.
- Idempotent usage recording keyed by provider message ID and direction.
- Accurate billing-period attribution for every segment.
- Outbound usage reservation before send and finalization after provider response.
- Enforcement of the approved overage budget before outbound sends.
- Default approved overage budget of $0.
- No automatic SMS overage billing from estimates.
- Reconciliation jobs against provider records.
- Clear provider-failure handling that does not discard inbound customer messages when outbound budget is exhausted.
- Audit trail tying usage records to the activated Stripe subscription and customer order.

MMS and voice are outside the current SMS allowance. Do not publish or bill MMS or voice rates until the business approves those terms.
