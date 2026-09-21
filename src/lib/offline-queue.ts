// Fila local (outbox) para uso sem internet.
//
// Toda escrita importante (venda do PDV, clientes, configurações da empresa)
// tenta ir direto ao banco. Se a rede falhar, o item é guardado no próprio
// aparelho e reenviado automaticamente quando a conexão voltar.
//
// Sem dependências novas: usa localStorage (funciona em web, PWA, Electron e
// no WebView do Android), o que mantém os builds do GitHub intactos.

import { supabase } from "@/integrations/supabase/client";

const KEY = "tc-outbox-v1";
const MAX_TRIES = 8;

export type SaleItemPayload = {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
};

export type SalePaymentPayload = {
  key: string;
  method: string;
  amount: number;
  due_date?: string | null;
};

export type SalePayload = {
  company_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_document: string | null;
  subtotal: number;
  discount: number;
  total: number;
  sold_by: string | null;
  notes: string | null;
  client_uuid: string;
  sold_at: string;
  items: SaleItemPayload[];
  payments: SalePaymentPayload[];
};

export type OutboxItem =
  | {
      id: string;
      createdAt: string;
      tries: number;
      lastError?: string;
      kind: "sale";
      label: string;
      payload: SalePayload;
    }
  | {
      id: string;
      createdAt: string;
      tries: number;
      lastError?: string;
      kind: "insert" | "update";
      label: string;
      table: string;
      rowId?: string;
      payload: Record<string, unknown>;
    };

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeOutbox(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function read(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* quota — ignora */
  }
  notify();
}

export function getPending(): OutboxItem[] {
  return read();
}

export function pendingCount(): number {
  return read().length;
}

export function newClientUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function enqueue(item: Omit<OutboxItem, "id" | "createdAt" | "tries">): OutboxItem {
  const full = {
    ...item,
    id: newClientUuid(),
    createdAt: new Date().toISOString(),
    tries: 0,
  } as OutboxItem;
  write([...read(), full]);
  return full;
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Erros de rede (sem internet, DNS, timeout) — diferentes de erro de regra do banco. */
export function isNetworkError(err: unknown): boolean {
  if (isOffline()) return true;
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    msg.includes("fetch failed") ||
    msg.includes("timeout") ||
    msg.includes("networkerror")
  );
}

// ---------------- Envio real ----------------

type AnyTable = {
  upsert: (p: Record<string, unknown>, o?: Record<string, unknown>) => Promise<{ error: Error | null }>;
  insert: (p: Record<string, unknown>) => Promise<{ error: Error | null }>;
  update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
};

function table(name: string): AnyTable {
  return supabase.from(name as never) as unknown as AnyTable;
}

/** Grava a venda completa (venda, itens, fiado e pagamentos). Idempotente por client_uuid. */
export async function submitSale(p: SalePayload): Promise<{ id: string; sold_at: string; total: number }> {
  const existing = await supabase
    .from("sales")
    .select("id, sold_at, total")
    .eq("client_uuid", p.client_uuid)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as { id: string; sold_at: string; total: number };

  const saleIns = await supabase
    .from("sales")
    .insert({
      company_id: p.company_id,
      customer_id: p.customer_id,
      subtotal: p.subtotal,
      discount: p.discount,
      total: p.total,
      sold_by: p.sold_by,
      notes: p.notes,
      sold_at: p.sold_at,
      client_uuid: p.client_uuid,
    })
    .select("id, sold_at, total")
    .single();
  if (saleIns.error) throw saleIns.error;
  const sale = saleIns.data as { id: string; sold_at: string; total: number };

  const itemsErr = (
    await supabase.from("sale_items").insert(
      p.items.map((i) => ({
        sale_id: sale.id,
        company_id: p.company_id,
        product_id: i.product_id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        total: i.quantity * i.unit_price - i.discount,
      })),
    )
  ).error;
  if (itemsErr) throw itemsErr;

  const notaPayments = p.payments.filter((x) => x.method === "nota");
  const otherPayments = p.payments.filter((x) => x.method !== "nota");

  let instIds: Record<string, string> = {};
  if (notaPayments.length > 0 && p.customer_id) {
    const totalNota = notaPayments.reduce((a, x) => a + x.amount, 0);
    const debtorIns = await supabase
      .from("debtors")
      .insert({
        company_id: p.company_id,
        customer_id: p.customer_id,
        name: p.customer_name ?? "Cliente",
        document: p.customer_document,
        description: `Venda #${sale.id.slice(0, 8)}`,
        total_amount: totalNota,
      })
      .select("id")
      .single();
    if (debtorIns.error) throw debtorIns.error;
    const debtorId = (debtorIns.data as { id: string }).id;

    const instRes = await supabase
      .from("debtor_installments")
      .insert(
        notaPayments.map((x, idx) => ({
          debtor_id: debtorId,
          company_id: p.company_id,
          sequence: idx + 1,
          due_date: x.due_date ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          amount: x.amount,
          status: "pending" as const,
        })),
      )
      .select("id");
    if (instRes.error) throw instRes.error;
    const ids = (instRes.data as { id: string }[]).map((r) => r.id);
    instIds = Object.fromEntries(notaPayments.map((x, idx) => [x.key, ids[idx]!]));
  }

  const payErr = (
    await supabase.from("sale_payments").insert([
      ...otherPayments.map((x) => ({
        sale_id: sale.id,
        company_id: p.company_id,
        method: x.method as never,
        amount: x.amount,
        status: "settled" as const,
        settled_at: new Date().toISOString(),
      })),
      ...notaPayments.map((x) => ({
        sale_id: sale.id,
        company_id: p.company_id,
        method: "nota" as never,
        amount: x.amount,
        status: "pending" as const,
        debtor_installment_id: instIds[x.key] ?? null,
      })),
    ])
  ).error;
  if (payErr) throw payErr;

  return sale;
}

async function apply(item: OutboxItem): Promise<void> {
  if (item.kind === "sale") {
    await submitSale(item.payload);
    return;
  }
  if (item.kind === "insert") {
    const { error } = item.payload["client_uuid"]
      ? await table(item.table).upsert(item.payload, { onConflict: "client_uuid" })
      : await table(item.table).insert(item.payload);
    if (error) throw error;
    return;
  }
  const { error } = await table(item.table).update(item.payload).eq("id", item.rowId!);
  if (error) throw error;
}

let flushing = false;

export type FlushResult = { sent: number; failed: number; remaining: number };

export async function flushOutbox(): Promise<FlushResult> {
  if (flushing) return { sent: 0, failed: 0, remaining: pendingCount() };
  if (isOffline()) return { sent: 0, failed: 0, remaining: pendingCount() };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    let queue = read();
    for (const item of [...queue]) {
      try {
        await apply(item);
        queue = read().filter((q) => q.id !== item.id);
        write(queue);
        sent++;
      } catch (err) {
        if (isNetworkError(err)) break; // ainda sem internet — tenta depois
        const msg = err instanceof Error ? err.message : String(err);
        const tries = item.tries + 1;
        queue = read()
          .map((q) => (q.id === item.id ? ({ ...q, tries, lastError: msg } as OutboxItem) : q))
          .filter((q) => !(q.id === item.id && tries >= MAX_TRIES));
        write(queue);
        failed++;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed, remaining: pendingCount() };
}
