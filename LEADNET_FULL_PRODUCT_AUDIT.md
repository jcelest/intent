# LeadNet Product Audit

The earlier audit in this file covered a superseded software-first sprint. It has been retired so it does not conflict with the revised website-first offer.

Current implementation notes:

- Pricing and terms are centralized in `src/lib/leadnet-offer.ts`.
- Agreement HTML is generated from the accepted order snapshot in `src/lib/capture-agreement.ts`.
- Accepted agreement content, hash, order snapshot, Stripe ids, and service states are persisted in the database.
- Checkout uses Stripe test mode only in this implementation.
- Monthly website orders create a managed website subscription with a one-time setup invoice item.
- Upfront website orders create a one-time payment and only save the payment method for future use when optional future subscriptions are selected.
- Website Care and LeadNet Follow-Up are activation-time subscriptions and are not silently created during website checkout.
- Automatic SMS overage billing is disabled until the companion LeadNet application provides trustworthy usage enforcement and reconciliation.
