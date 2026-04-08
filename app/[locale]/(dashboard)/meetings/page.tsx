import { getOrganizationForUser } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function MeetingsPage() {
  const org = await getOrganizationForUser();
  if (!org) return null;
  const supabase = await createClient();
  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .eq("organization_id", org.id)
    .order("scheduled_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Meetings</h1>
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(meetings ?? []).map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  {m.scheduled_at
                    ? new Date(m.scheduled_at).toLocaleString()
                    : "—"}
                </TableCell>
                <TableCell>{m.status}</TableCell>
                <TableCell>
                  {m.revenue_attributed != null
                    ? `$${Number(m.revenue_attributed).toFixed(0)}`
                    : "—"}
                </TableCell>
                <TableCell>
                  {m.booking_url ? (
                    <a
                      href={m.booking_url}
                      className="text-primary underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
