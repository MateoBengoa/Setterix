import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationForUser } from "@/lib/org";
import { OrgProvider } from "@/context/org-context";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const org = await getOrganizationForUser();
  if (!org) {
    redirect(`/${locale}/connect-meta`);
  }

  return (
    <OrgProvider org={org}>
      <div className="flex min-h-screen flex-col bg-background">
        <DashboardNav />
        <main className="flex-1 overflow-auto bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(227,104,135,0.08),transparent)] px-4 pb-8 pt-20 md:px-8">
          {children}
        </main>
      </div>
    </OrgProvider>
  );
}
