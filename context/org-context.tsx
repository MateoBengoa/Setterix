"use client";

import { createContext, useContext } from "react";
import type { Organization } from "@/lib/org";

const OrgContext = createContext<Organization | null>(null);

export function OrgProvider({
  org,
  children,
}: {
  org: Organization | null;
  children: React.ReactNode;
}) {
  return <OrgContext.Provider value={org}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  return useContext(OrgContext);
}

export function usePlan() {
  const org = useOrg();
  const plan = org?.plan ?? "trial";
  return {
    plan,
    isPro: plan === "pro" || plan === "agency",
    isAgency: plan === "agency",
    isStarter: plan === "starter",
  };
}
