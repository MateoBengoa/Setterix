/**
 * DodoPayments — use REST/SDK from your Dodo dashboard.
 * Replace endpoints with the official hosted checkout + portal URLs.
 */

export function createCheckoutSessionUrl(
  orgId: string,
  planId: string,
  appUrl: string
): string {
  const base = process.env.NEXT_PUBLIC_DODO_CHECKOUT_BASE ?? "https://checkout.dodopayments.com";
  const params = new URLSearchParams({
    plan: planId,
    client_reference_id: orgId,
    success_url: `${appUrl}/settings/billing?success=1`,
    cancel_url: `${appUrl}/settings/billing`,
  });
  return `${base}?${params.toString()}`;
}

export function createCustomerPortalSessionUrl(
  orgId: string,
  customerId: string,
  appUrl: string
): string {
  const base =
    process.env.NEXT_PUBLIC_DODO_PORTAL_BASE ?? "https://billing.dodopayments.com/portal";
  const params = new URLSearchParams({
    customer_id: customerId,
    return_url: `${appUrl}/settings/billing`,
    client_reference_id: orgId,
  });
  return `${base}?${params.toString()}`;
}
