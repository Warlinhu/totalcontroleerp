import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Search, Printer, ShoppingCart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { useSession } from "@/lib/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/pos")({
  head: () => ({ meta: [{ title: "PDV — TotalControle ERP" }] }),
  component: PosPage,
});

type Product = {
  id: string; name: string; sku: string | null; price: number;
  kind: "product" | "service"; active: boolean;
};
type Customer = { id: string; name: string; document: string | null };
type CartItem = {
  key: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
};
type PaymentMethod =
  | "dinheiro" | "credito" | "debito" | "pix" | "alimentacao" | "voucher" | "nota";
type PaymentRow = { key: string; method: PaymentMethod; amount: number; due_date?: string };

const METHOD_LABEL: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  credito: "Cartão Crédito",
  debito: "Cartão Débito",
  pix: "PIX",
  alimentacao: "Cartão Alimentação",
  voucher: "Voucher",
  nota: "Nota (Fiado)",
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PosPage() {
  const { currentCompanyId } = useCompany();
  const { user } = useSession();
  const qc = useQueryClient();

  const [productSearch, setProductSearch] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    sale: { id: string; sold_at: string; total: number };
    items: CartItem[];
    payments: PaymentRow[];
    customer: Customer | null;
  } | null>(null);

  const productsQ = useQuery({
    queryKey: ["pos-products", currentCompanyId],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,sku,price,kind,active")
        .eq("company_id", currentCompanyId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const customersQ = useQuery({
    queryKey: ["pos-customers", currentCompanyId],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name,document")
        .eq("company_id", currentCompanyId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const list = productsQ.data ?? [];
    if (!q) return list.slice(0, 40);
    return list
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [productSearch, productsQ.data]);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (acc, i) => acc + i.quantity * i.unit_price - i.discount,
        0,
      ),
    [cart],
  );
  const total = Math.max(0, subtotal - discount);
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const remaining = Math.max(0, total - paid);
  const hasNota = payments.some((p) => p.method === "nota");

  const addProduct = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          product_id: p.id,
          description: p.name,
          quantity: 1,
          unit_price: Number(p.price),
          discount: 0,
        },
      ];
    });
  };

  const addManualItem = () => {
    setCart((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        product_id: null,
        description: "Item avulso",
        quantity: 1,
        unit_price: 0,
        discount: 0,
      },
    ]);
  };

  const updateItem = (key: string, patch: Partial<CartItem>) =>
    setCart((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const removeItem = (key: string) =>
    setCart((prev) => prev.filter((i) => i.key !== key));

  const addPayment = (method: PaymentMethod) => {
    setPayments((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        method,
        amount: Math.max(0, total - prev.reduce((a, p) => a + p.amount, 0)),
        due_date:
          method === "nota"
            ? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
            : undefined,
      },
    ]);
  };

  const updatePayment = (key: string, patch: Partial<PaymentRow>) =>
    setPayments((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const removePayment = (key: string) =>
    setPayments((prev) => prev.filter((p) => p.key !== key));

  const reset = () => {
    setCart([]);
    setPayments([]);
    setDiscount(0);
    setNotes("");
    setCustomerId("");
  };

  const finalize = async () => {
    if (!currentCompanyId) return;
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }
    if (payments.length === 0) {
      toast.error("Informe pelo menos uma forma de pagamento");
      return;
    }
    if (Math.abs(paid - total) > 0.005) {
      toast.error(`Valor pago (${brl(paid)}) difere do total (${brl(total)})`);
      return;
    }
    if (hasNota && !customerId) {
      toast.error("Selecione um cliente para vendas com 'Nota'");
      return;
    }

    setSaving(true);
    try {
      // Insert sale
      const saleInsert = await supabase
        .from("sales")
        .insert({
          company_id: currentCompanyId,
          customer_id: customerId || null,
          subtotal,
          discount,
          total,
          sold_by: user?.id ?? null,
          notes: notes.trim() || null,
        })
        .select("id, sold_at, total")
        .single();
      if (saleInsert.error) throw saleInsert.error;
      const sale = saleInsert.data as { id: string; sold_at: string; total: number };

      // Insert items
      const { error: itemsErr } = await supabase.from("sale_items").insert(
        cart.map((i) => ({
          sale_id: sale.id,
          company_id: currentCompanyId,
          product_id: i.product_id,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: i.discount,
          total: i.quantity * i.unit_price - i.discount,
        })),
      );
      if (itemsErr) throw itemsErr;

      // For nota payments: create debtor + installment, then link
      const notaPayments = payments.filter((p) => p.method === "nota");
      const otherPayments = payments.filter((p) => p.method !== "nota");

      let debtorInstallmentIds: Record<string, string> = {};
      if (notaPayments.length > 0 && customerId) {
        const customer = customersQ.data?.find((c) => c.id === customerId);
        const totalNota = notaPayments.reduce((a, p) => a + p.amount, 0);
        const debtorIns = await supabase
          .from("debtors")
          .insert({
            company_id: currentCompanyId,
            customer_id: customerId,
            name: customer?.name ?? "Cliente",
            document: customer?.document ?? null,
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
            notaPayments.map((p, idx) => ({
              debtor_id: debtorId,
              company_id: currentCompanyId,
              sequence: idx + 1,
              due_date:
                p.due_date ??
                new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
              amount: p.amount,
              status: "pending" as const,
            })),
          )
          .select("id");
        if (instRes.error) throw instRes.error;
        const ids = (instRes.data as { id: string }[]).map((r) => r.id);
        debtorInstallmentIds = Object.fromEntries(
          notaPayments.map((p, idx) => [p.key, ids[idx]]),
        );
      }

      // Insert payments
      const paymentRows = [
        ...otherPayments.map((p) => ({
          sale_id: sale.id,
          company_id: currentCompanyId,
          method: p.method,
          amount: p.amount,
          status: "settled" as const,
          settled_at: new Date().toISOString(),
        })),
        ...notaPayments.map((p) => ({
          sale_id: sale.id,
          company_id: currentCompanyId,
          method: "nota" as const,
          amount: p.amount,
          status: "pending" as const,
          debtor_installment_id: debtorInstallmentIds[p.key],
        })),
      ];
      const { error: payErr } = await supabase.from("sale_payments").insert(paymentRows);
      if (payErr) throw payErr;

      toast.success("Venda registrada!");
      const customer = customersQ.data?.find((c) => c.id === customerId) ?? null;
      setLastReceipt({ sale, items: cart, payments, customer });
      reset();
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar venda");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">PDV — Ponto de Venda</h1>
          <p className="text-sm text-muted-foreground">
            Registre vendas com múltiplas formas de pagamento.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <ShoppingCart className="h-3.5 w-3.5" />
          {cart.length} {cart.length === 1 ? "item" : "itens"}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        {/* Left column: products + cart */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Produtos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou SKU..."
                  className="pl-8"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="flex flex-col items-start rounded-md border p-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span className="font-medium truncate w-full">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.sku ? `${p.sku} · ` : ""}{brl(Number(p.price))}
                    </span>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full">
                    Nenhum produto encontrado.
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={addManualItem}>
                <Plus className="mr-1 h-4 w-4" /> Item avulso
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Carrinho</CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>
              ) : (
                <div className="space-y-2">
                  {cart.map((i) => (
                    <div
                      key={i.key}
                      className="grid grid-cols-[1fr_80px_100px_100px_40px] items-center gap-2 rounded-md border p-2"
                    >
                      <Input
                        value={i.description}
                        onChange={(e) => updateItem(i.key, { description: e.target.value })}
                      />
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={i.quantity}
                        onChange={(e) =>
                          updateItem(i.key, { quantity: Number(e.target.value) || 0 })
                        }
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={i.unit_price}
                        onChange={(e) =>
                          updateItem(i.key, { unit_price: Number(e.target.value) || 0 })
                        }
                      />
                      <div className="text-right text-sm font-medium">
                        {brl(i.quantity * i.unit_price - i.discount)}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(i.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: checkout */}
        <Card className="lg:sticky lg:top-20 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Finalização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                Cliente {hasNota && <span className="text-destructive">*</span>}
              </Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cliente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {(customersQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Desconto geral (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              />
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{brl(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desconto</span>
                <span>-{brl(discount)}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{brl(total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pagamentos</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
                  <Button
                    key={m}
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs"
                    onClick={() => addPayment(m)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {METHOD_LABEL[m]}
                  </Button>
                ))}
              </div>
              {payments.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {payments.map((p) => (
                    <div
                      key={p.key}
                      className={cn(
                        "grid items-center gap-1.5 rounded-md border p-2 text-sm",
                        p.method === "nota"
                          ? "grid-cols-[1fr_100px_110px_32px] bg-amber-50 dark:bg-amber-950/30"
                          : "grid-cols-[1fr_100px_32px]",
                      )}
                    >
                      <span className="text-xs font-medium truncate">
                        {METHOD_LABEL[p.method]}
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={p.amount}
                        onChange={(e) =>
                          updatePayment(p.key, { amount: Number(e.target.value) || 0 })
                        }
                        className="h-8"
                      />
                      {p.method === "nota" && (
                        <Input
                          type="date"
                          value={p.due_date}
                          onChange={(e) => updatePayment(p.key, { due_date: e.target.value })}
                          className="h-8"
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removePayment(p.key)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-muted-foreground">Pago</span>
                    <span>{brl(paid)}</span>
                  </div>
                  <div
                    className={cn(
                      "flex justify-between text-xs font-medium",
                      Math.abs(remaining) < 0.005 ? "text-emerald-600" : "text-destructive",
                    )}
                  >
                    <span>Restante</span>
                    <span>{brl(remaining)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {hasNota && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                💡 O valor em <strong>Nota</strong> gera Contas a Receber e só entra no
                faturamento quando o cliente pagar.
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} disabled={saving}>
                Limpar
              </Button>
              <Button className="flex-1" onClick={finalize} disabled={saving}>
                {saving ? "Registrando..." : "Finalizar venda"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ReceiptDialog receipt={lastReceipt} onClose={() => setLastReceipt(null)} />
    </div>
  );
}

function ReceiptDialog({
  receipt,
  onClose,
}: {
  receipt: {
    sale: { id: string; sold_at: string; total: number };
    items: CartItem[];
    payments: PaymentRow[];
    customer: Customer | null;
  } | null;
  onClose: () => void;
}) {
  const { current } = useCompany();
  if (!receipt) return null;
  const { sale, items, payments, customer } = receipt;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cupom da Venda</DialogTitle>
        </DialogHeader>
        <div id="receipt-print" className="text-sm font-mono space-y-1">
          <div className="text-center font-semibold">{current?.company.name}</div>
          <div className="text-center text-xs text-muted-foreground">
            Venda #{sale.id.slice(0, 8).toUpperCase()}
          </div>
          <div className="text-center text-xs text-muted-foreground">
            {new Date(sale.sold_at).toLocaleString("pt-BR")}
          </div>
          {customer && <div className="text-xs">Cliente: {customer.name}</div>}
          <Separator className="my-2" />
          {items.map((i) => (
            <div key={i.key} className="flex justify-between text-xs">
              <span className="truncate mr-2">
                {i.quantity}x {i.description}
              </span>
              <span>{brl(i.quantity * i.unit_price - i.discount)}</span>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold">
            <span>TOTAL</span>
            <span>{brl(sale.total)}</span>
          </div>
          <Separator className="my-2" />
          {payments.map((p) => (
            <div key={p.key} className="flex justify-between text-xs">
              <span>{METHOD_LABEL[p.method]}</span>
              <span>{brl(p.amount)}</span>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
