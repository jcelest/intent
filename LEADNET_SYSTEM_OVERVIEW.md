# LeadNet System Overview

This document previously described the superseded software-first LeadNet sprint offer. The current purchase flow is website-first and is defined in:

- `src/lib/leadnet-offer.ts`
- `src/lib/capture-agreement.ts`
- `src/app/api/agreement/accept/route.ts`
- `src/app/api/stripe/intent/route.ts`
- `src/app/api/stripe/webhook/route.ts`

Current offer summary:

- Business Website: monthly setup plus monthly managed website, or upfront purchase.
- Expanded Website: monthly setup plus monthly managed website, or upfront purchase.
- Optional Website Care: available only to upfront buyers and starts at hosting activation.
- Optional LeadNet Follow-Up: starts at LeadNet activation.
- SMS overage billing remains disabled until companion-app usage controls provide verified provider message IDs, segment counts, billing periods, idempotent usage records, reservations, approved budgets, and reconciliation.
