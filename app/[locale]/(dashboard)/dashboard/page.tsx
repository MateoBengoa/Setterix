import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationForUser } from "@/lib/org";
import { DashboardChart } from "@/components/dashboard/dashboard-chart";
import { NudgeBanner } from "@/components/dashboard/nudge-banner";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="premium-metric">
      <div className="premium-metric-inner">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f3d98f]/80">
          {label}
        </p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const org = await getOrganizationForUser();
  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: rows } = org
    ? await supabase
        .from("analytics_daily")
        .select("*")
        .eq("organization_id", org.id)
        .gte("date", sinceStr)
        .order("date", { ascending: true })
    : { data: [] as Record<string, unknown>[] };

  const list = rows ?? [];
  const revenue = list.reduce(
    (a, r) => a + Number((r as { revenue_attributed?: number }).revenue_attributed ?? 0),
    0
  );
  const convos = list.reduce(
    (a, r) => a + Number((r as { conversations_started?: number }).conversations_started ?? 0),
    0
  );
  const meetings = list.reduce(
    (a, r) => a + Number((r as { meetings_booked?: number }).meetings_booked ?? 0),
    0
  );
  const rate = convos > 0 ? Math.round((meetings / convos) * 1000) / 10 : 0;

  const chartData = list.map((r) => ({
    date: String((r as { date: string }).date).slice(5),
    meetings_booked: Number((r as { meetings_booked?: number }).meetings_booked ?? 0),
    revenue_attributed: Number((r as { revenue_attributed?: number }).revenue_attributed ?? 0),
  }));

  const { data: hotLeads } = org
    ? await supabase
        .from("leads")
        .select("id, name, username, status, updated_at, meta_account_id")
        .eq("organization_id", org.id)
        .eq("status", "qualifying")
        .order("updated_at", { ascending: false })
        .limit(8)
    : { data: [] };

  const { data: metaRows } = org
    ? await supabase
        .from("meta_accounts")
        .select("id, platform")
        .eq("organization_id", org.id)
    : { data: [] };

  const platformByMetaId = Object.fromEntries(
    (metaRows ?? []).map((m) => [m.id, m.platform])
  );

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <NudgeBanner />
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("revenueAttributed")}
          value={`$${revenue.toFixed(0)}`}
        />
        <MetricCard label={t("conversationsStarted")} value={convos} />
        <MetricCard label={t("meetingsBooked")} value={meetings} />
        <MetricCard label={t("conversionRate")} value={`${rate}%`} />
      </div>

      <div className="premium-surface relative p-6 md:p-8">
        <div className="relative z-[1]">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {t("chartTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("chartLegend")}</p>
            </div>
          </div>
          <DashboardChart data={chartData} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          {t("hotLeads")}
        </h2>
        <ul className="space-y-2">
          {(hotLeads ?? []).map((lead) => (
            <li
              key={lead.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#0e0e0e] px-4 py-3 transition-colors hover:border-[rgba(227,104,135,0.2)]"
            >
              <div>
                <p className="font-medium tracking-tight">
                  {lead.name ?? lead.username ?? "Lead"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lead.meta_account_id
                    ? platformByMetaId[lead.meta_account_id] ?? "—"
                    : "—"}
                </p>
              </div>
              <Link
                href="/inbox"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "rounded-full border-[rgba(243,217,143,0.25)] bg-transparent text-[#f3d98f] hover:bg-[#f3d98f]/10 hover:text-[#f3d98f]"
                )}
              >
                {t("viewConversation")}
              </Link>
            </li>
          ))}
          {!hotLeads?.length ? (
            <li className="rounded-xl border border-dashed border-white/10 bg-[#0c0c0c] px-4 py-8 text-center text-sm text-muted-foreground">
              {t("noQualifyingLeads")}
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
