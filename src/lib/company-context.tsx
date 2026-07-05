import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CompanyRole = "owner" | "admin" | "employee";

export type CompanyMembership = {
  company_id: string;
  role: CompanyRole;
  company: {
    id: string;
    name: string;
    document: string | null;
    email: string | null;
    phone: string | null;
  };
};

type CompanyContextValue = {
  memberships: CompanyMembership[];
  current: CompanyMembership | null;
  currentCompanyId: string | null;
  currentRole: CompanyRole | null;
  isManager: boolean;
  setCurrentCompanyId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
};

const STORAGE_KEY = "totalcontrole.current_company";

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [currentId, setCurrentId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  const query = useQuery({
    queryKey: ["memberships", userId],
    queryFn: async (): Promise<CompanyMembership[]> => {
      const { data, error } = await supabase
        .from("company_members")
        .select("company_id, role, company:companies(id, name, document, email, phone)")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).filter((r) => r.company) as unknown as CompanyMembership[];
    },
  });

  const memberships = query.data ?? [];

  useEffect(() => {
    if (memberships.length === 0) return;
    if (!currentId || !memberships.some((m) => m.company_id === currentId)) {
      const next = memberships[0].company_id;
      setCurrentId(next);
      localStorage.setItem(STORAGE_KEY, next);
    }
  }, [memberships, currentId]);

  const current = useMemo(
    () => memberships.find((m) => m.company_id === currentId) ?? null,
    [memberships, currentId],
  );

  const value: CompanyContextValue = {
    memberships,
    current,
    currentCompanyId: current?.company_id ?? null,
    currentRole: current?.role ?? null,
    isManager: current?.role === "owner" || current?.role === "admin",
    setCurrentCompanyId: (id) => {
      setCurrentId(id);
      localStorage.setItem(STORAGE_KEY, id);
    },
    loading: query.isLoading,
    refresh: async () => {
      await query.refetch();
    },
  };

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
}
