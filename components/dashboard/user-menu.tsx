"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ email }: { email?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 w-full max-w-full cursor-pointer items-center truncate rounded-full border border-[rgba(243,217,143,0.18)] bg-[#0c0c0c] px-3 text-left text-[12px] font-medium text-muted-foreground outline-none transition-colors hover:border-[rgba(227,104,135,0.35)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-[#e36887]/50">
        {email ?? "…"}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 border-white/10 bg-[#141414] text-foreground"
      >
        <DropdownMenuItem
          onClick={logout}
          className="focus:bg-[#e36887]/15 focus:text-[#f3d98f]"
        >
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
