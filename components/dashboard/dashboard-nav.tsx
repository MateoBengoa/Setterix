"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", key: "dashboard" as const },
  { href: "/inbox", key: "inbox" as const },
  { href: "/leads", key: "leads" as const },
  { href: "/campaigns", key: "campaigns" as const },
  { href: "/sequences", key: "sequences" as const },
  { href: "/meetings", key: "meetings" as const },
];

const settingsItems = [
  { href: "/settings/agent", key: "agent" as const },
  { href: "/settings/integrations", key: "integrations" as const },
  { href: "/settings/team", key: "team" as const },
  { href: "/settings/billing", key: "billing" as const },
];

export function DashboardNav({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const linkClass = (href: string, active: boolean) =>
    cn(
      "relative block rounded-xl px-3 py-2.5 text-[13px] font-medium tracking-tight transition-all duration-200",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_#e36887]"
        : "text-sidebar-foreground/75 hover:bg-white/[0.04] hover:text-sidebar-foreground"
    );

  return (
    <nav className={cn("flex flex-col gap-8", className)}>
      <div className="space-y-0.5">
        {items.map(({ href, key }) => {
          const active =
            pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={linkClass(href, Boolean(active))}
            >
              {t(key)}
            </Link>
          );
        })}
      </div>
      <div>
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f3d98f]/70">
          {t("settings")}
        </p>
        <div className="space-y-0.5">
          {settingsItems.map(({ href, key }) => {
            const active =
              pathname === href || pathname?.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={linkClass(href, Boolean(active))}
              >
                {t(key)}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
