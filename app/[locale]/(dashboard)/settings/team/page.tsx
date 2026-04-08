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

export default async function TeamPage() {
  const org = await getOrganizationForUser();
  if (!org) return null;
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("org_members")
    .select("user_id, role, created_at")
    .eq("organization_id", org.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Team</h1>
      <p className="text-sm text-muted-foreground">
        Invite teammates via Supabase Auth <code className="rounded bg-muted px-1">inviteUserByEmail</code>{" "}
        (service role) and add rows to org_members when they accept.
      </p>
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(members ?? []).map((m) => (
              <TableRow key={m.user_id}>
                <TableCell className="font-mono text-xs">{m.user_id}</TableCell>
                <TableCell>{m.role}</TableCell>
                <TableCell>
                  {m.created_at
                    ? new Date(m.created_at).toLocaleDateString()
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
