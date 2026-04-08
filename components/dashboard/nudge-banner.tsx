"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";

export function NudgeBanner() {
  const t = useTranslations("dashboard");
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl border border-[rgba(243,217,143,0.15)] bg-gradient-to-r from-[#e36887]/10 via-[#111] to-[#f3d98f]/10 px-5 py-4 text-sm shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#e36887] to-[#f3d98f]"
        aria-hidden
      />
      <div className="flex flex-wrap items-center justify-between gap-4 pl-2">
        <span className="font-medium tracking-tight text-foreground/95">
          {t("nudgeCampaign")}
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/campaigns"
            className={cn(
              buttonVariants({ size: "sm" }),
              "rounded-full bg-[#e36887] font-semibold text-[#0a0a0a] shadow-[0_0_20px_rgba(227,104,135,0.35)] hover:bg-[#e8809a]"
            )}
          >
            {t("nudgeCampaign")}
          </Link>
          <button
            type="button"
            aria-label={t("nudgeDismiss")}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
