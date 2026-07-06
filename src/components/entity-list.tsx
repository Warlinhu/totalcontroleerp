import { useState, type ReactNode } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

type Props<T extends { id: string }> = {
  title: string;
  description?: string;
  rows: T[];
  loading: boolean;
  columns: Column<T>[];
  searchPlaceholder?: string;
  onSearch?: (q: string) => void;
  canManage: boolean;
  onCreate: () => void;
  onEdit: (row: T) => void;
  onDelete: (row: T) => Promise<void> | void;
  emptyMessage?: string;
  formOpen: boolean;
  formTitle: string;
  formDescription?: string;
  onFormOpenChange: (open: boolean) => void;
  onSubmit: () => Promise<void> | void;
  submitting: boolean;
  children: ReactNode;
};

export function EntityList<T extends { id: string }>(props: Props<T>) {
  const [confirm, setConfirm] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{props.title}</h1>
          {props.description && (
            <p className="text-sm text-muted-foreground">{props.description}</p>
          )}
        </div>
        {props.canManage && (
          <Button onClick={props.onCreate}>
            <Plus className="mr-2 h-4 w-4" /> Novo
          </Button>
        )}
      </div>

      {props.onSearch && (
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={props.searchPlaceholder ?? "Buscar..."}
            onChange={(e) => props.onSearch?.(e.target.value)}
          />
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {props.columns.map((c) => (
                <TableHead key={c.header} className={c.className}>{c.header}</TableHead>
              ))}
              {props.canManage && <TableHead className="w-24 text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.loading ? (
              <TableRow>
                <TableCell colSpan={props.columns.length + 1} className="text-center text-sm text-muted-foreground py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : props.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={props.columns.length + 1} className="text-center text-sm text-muted-foreground py-8">
                  {props.emptyMessage ?? "Nenhum registro encontrado."}
                </TableCell>
              </TableRow>
            ) : (
              props.rows.map((row) => (
                <TableRow key={row.id}>
                  {props.columns.map((c) => (
                    <TableCell key={c.header} className={c.className}>{c.cell(row)}</TableCell>
                  ))}
                  {props.canManage && (
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => props.onEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirm(row)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={props.formOpen} onOpenChange={props.onFormOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{props.formTitle}</DialogTitle>
            {props.formDescription && <DialogDescription>{props.formDescription}</DialogDescription>}
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await props.onSubmit();
            }}
            className="space-y-4"
          >
            <div className="space-y-4">{props.children}</div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => props.onFormOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={props.submitting}>
                {props.submitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirm) return;
                setDeleting(true);
                try {
                  await props.onDelete(confirm);
                  setConfirm(null);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
