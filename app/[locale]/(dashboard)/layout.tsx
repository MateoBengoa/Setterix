import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationForUser } from "@/lib/org";
import { OrgProvider } from "@/context/org-context";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

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

  const t = await getTranslations("common");

  return (
    <OrgProvider org={org}>
      <div className="flex min-h-screen flex-col bg-background md:flex-row">
        <aside className="border-b border-sidebar-border/80 bg-sidebar md:w-60 md:shrink-0 md:border-b-0 md:border-r md:border-sidebar-border md:shadow-[inset_-1px_0_0_rgba(243,217,143,0.06)]">
          <div className="flex items-center justify-between gap-2 p-5 md:flex-col md:items-stretch md:gap-4">
            <Link
              href="/dashboard"
              className="text-[15px] font-semibold tracking-tight text-foreground"
            >
              <span className="bg-gradient-to-r from-[#f3d98f] to-[#e36887] bg-clip-text text-transparent">
                {t("appName")}
              </span>
            </Link>
            <div className="hidden w-full md:block">
              <UserMenu email={user.email ?? undefined} />
            </div>
          </div>
          <div className="px-3 pb-5">
            <DashboardNav />
          </div>
          <div className="border-t border-sidebar-border/80 p-4 md:hidden">
            <UserMenu email={user.email ?? undefined} />
          </div>
        </aside>
        <main className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(227,104,135,0.08),transparent)] p-4 md:p-8">
          {children}
        </main>
      </div>
    </OrgProvider>
  );
}
