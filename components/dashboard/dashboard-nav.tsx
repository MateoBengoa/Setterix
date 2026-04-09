"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Inbox,
  Users,
  Megaphone,
  CalendarDays,
  Settings,
  Bot,
  Plug,
  UsersRound,
  CreditCard,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mainItems = [
  { href: "/dashboard",  key: "dashboard"  as const, Icon: LayoutDashboard },
  { href: "/inbox",      key: "inbox"      as const, Icon: Inbox           },
  { href: "/leads",      key: "leads"      as const, Icon: Users           },
  { href: "/campaigns",  key: "campaigns"  as const, Icon: Megaphone       },
  { href: "/meetings",   key: "meetings"   as const, Icon: CalendarDays    },
];

const settingsItems = [
  { href: "/settings/agent",        key: "agent"        as const, Icon: Bot        },
  { href: "/settings/integrations", key: "integrations" as const, Icon: Plug       },
  { href: "/settings/team",         key: "team"         as const, Icon: UsersRound },
  { href: "/settings/billing",      key: "billing"      as const, Icon: CreditCard },
];

export function DashboardNav() {
  const t   = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isSettingsActive = settingsItems.some(
    (item) => pathname === item.href || pathname?.startsWith(item.href + "/")
  );

  return (
    <nav className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-0.5 rounded-2xl border border-white/10 bg-[#0d0d0d]/90 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {mainItems.map(({ href, key, Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-all duration-200",
                active
                  ? "bg-white/10 text-[#f3d98f]"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
              )}
            >
              <Icon
                className={cn("size-[18px]", active ? "text-[#e36887]" : "")}
                strokeWidth={active ? 2.2 : 1.7}
              />
              {t(key)}
            </Link>
          );
        })}

        <div className="mx-1 h-6 w-px bg-white/10" />

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium outline-none transition-all duration-200",
              isSettingsActive
                ? "bg-white/10 text-[#f3d98f]"
                : "text-white/50 hover:bg-white/5 hover:text-white/80"
            )}
          >
            <Settings
              className={cn("size-[18px]", isSettingsActive ? "text-[#e36887]" : "")}
              strokeWidth={isSettingsActive ? 2.2 : 1.7}
            />
            {t("settings")}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            className="mb-2 w-48 border-white/10 bg-[#141414] text-foreground"
          >
            {settingsItems.map(({ href, key, Icon }) => (
              <DropdownMenuItem
                key={href}
                onClick={() => router.push(href)}
                className="flex items-center gap-2 focus:bg-white/5 focus:text-[#f3d98f]"
              >
                <Icon className="size-3.5 text-white/50" strokeWidth={1.7} />
                {t(key)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={logout}
              className="flex items-center gap-2 focus:bg-[#e36887]/15 focus:text-[#f3d98f]"
            >
              <LogOut className="size-3.5 text-white/50" strokeWidth={1.7} />
              {tAuth("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
