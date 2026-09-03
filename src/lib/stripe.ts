import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripe) {
    stripe = new Stripe(key);
  }
  return stripe;
}

type InvoiceLike = Stripe.Invoice | string | null | undefined;

/** Resolve PaymentIntent from current Stripe invoice.payments shape. */
export async function resolvePaymentIntentFromInvoice(
  client: Stripe,
  invoice: InvoiceLike
): Promise<Stripe.PaymentIntent | null> {
  if (!invoice) return null;

  const resolvedInvoice =
    typeof invoice === "string"
      ? await client.invoices.retrieve(invoice, { expand: ["payments"] })
      : invoice.payments?.data?.length
        ? invoice
        : await client.invoices.retrieve(invoice.id, { expand: ["payments"] });

  const paymentRef = resolvedInvoice.payments?.data?.[0]?.payment?.payment_intent;
  if (!paymentRef) return null;

  if (typeof paymentRef === "string") {
    return client.paymentIntents.retrieve(paymentRef);
  }

  return paymentRef;
}
