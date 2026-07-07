import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";

type TableName = "products" | "customers" | "suppliers" | "employees" | "debtors" | "payables" | "invoices";

export function useEntityCrud<T extends { id: string }>(table: TableName, orderBy = "created_at") {
  const { currentCompanyId, isManager } = useCompany();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<T | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const query = useQuery({
    queryKey: [table, currentCompanyId],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("company_id", currentCompanyId!)
        .order(orderBy, { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!currentCompanyId) throw new Error("Selecione uma empresa");
      const client = supabase.from(table) as unknown as {
        update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
        insert: (p: Record<string, unknown>) => Promise<{ error: Error | null }>;
      };
      if (editing) {
        const { error } = await client.update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await client.insert({ ...payload, company_id: currentCompanyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table, currentCompanyId] });
      toast.success(editing ? "Registro atualizado" : "Registro criado");
      setFormOpen(false);
      setEditing(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (row: T) => {
      const { error } = await supabase.from(table).delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table, currentCompanyId] });
      toast.success("Registro excluído");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    canManage: isManager,
    editing,
    formOpen,
    submitting: save.isPending,
    openCreate: () => { setEditing(null); setFormOpen(true); },
    openEdit: (row: T) => { setEditing(row); setFormOpen(true); },
    setFormOpen: (o: boolean) => { setFormOpen(o); if (!o) setEditing(null); },
    save: (payload: Record<string, unknown>) => save.mutateAsync(payload),
    remove: (row: T) => remove.mutateAsync(row),
  };
}
