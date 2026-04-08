import { getOrganizationForUser } from "@/lib/org";
import {
  createCheckoutSessionUrl,
  createCustomerPortalSessionUrl,
} from "@/lib/dodo/payments";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string };
}) {
  const org = await getOrganizationForUser();
  if (!org) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const starter = createCheckoutSessionUrl(org.id, "starter", appUrl);
  const pro = createCheckoutSessionUrl(org.id, "pro", appUrl);
  const agency = createCheckoutSessionUrl(org.id, "agency", appUrl);
  const portal =
    org.dodo_customer_id &&
    createCustomerPortalSessionUrl(org.id, org.dodo_customer_id, appUrl);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      {searchParams.success ? (
        <p className="text-sm text-primary">Payment received — thank you.</p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Current plan: <strong>{org.plan}</strong>
      </p>
      <div className="flex flex-col gap-3">
        <a
          href={starter}
          className={cn(buttonVariants({ variant: "secondary" }))}
        >
          Starter — checkout
        </a>
        <a href={pro} className={cn(buttonVariants({ variant: "secondary" }))}>
          Pro — checkout
        </a>
        <a
          href={agency}
          className={cn(buttonVariants({ variant: "secondary" }))}
        >
          Agency — checkout
        </a>
        {portal ? (
          <a
            href={portal}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Customer portal
          </a>
        ) : null}
      </div>
    </div>
  );
}
