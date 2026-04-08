import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationForUser } from "@/lib/org";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const t = await getTranslations("leads");
  const org = await getOrganizationForUser();
  if (!org) return null;
  const supabase = await createClient();
  let q = supabase
    .from("leads")
    .select("id, name, username, status, meta_account_id, updated_at")
    .eq("organization_id", org.id)
    .order("updated_at", { ascending: false });
  if (searchParams.status) {
    q = q.eq("status", searchParams.status);
  }
  const { data: leads } = await q;

  const { data: metaRows } = await supabase
    .from("meta_accounts")
    .select("id, platform")
    .eq("organization_id", org.id);
  const plat = Object.fromEntries(
    (metaRows ?? []).map((m) => [m.id, m.platform])
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("platform")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(leads ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name ?? row.username ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.status}</Badge>
                </TableCell>
                <TableCell>
                  {row.meta_account_id
                    ? plat[row.meta_account_id] ?? "—"
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
