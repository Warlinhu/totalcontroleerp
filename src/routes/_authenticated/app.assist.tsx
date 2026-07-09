import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { runAssist, SUGGESTIONS, type AssistResult } from "@/lib/assist/intents";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/assist")({
  head: () => ({ meta: [{ title: "Assistente — TotalControle ERP" }] }),
  component: AssistPage,
});

type Message = { role: "user" | "assist"; content: AssistResult | string };

function AssistPage() {
  const { currentCompanyId } = useCompany();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assist",
      content: {
        title: "Olá! Sou seu assistente local.",
        markdown:
          "Faço consultas rápidas sobre seus dados **sem consumir créditos de IA**. Experimente uma das sugestões abaixo ou digite sua pergunta.",
      },
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    inputRef.current?.focus();
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || !currentCompanyId || loading) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await runAssist(text, currentCompanyId);
      setMessages((m) => [...m, { role: "assist", content: res }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assist",
          content: {
            title: "Erro",
            markdown: e instanceof Error ? e.message : "Falha ao processar",
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Assistente
        </h1>
        <p className="text-sm text-muted-foreground">
          Perguntas sobre seu negócio — respondidas localmente, sem custo.
        </p>
      </div>

      <Card className="min-h-[420px]">
        <CardContent className="p-4 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[80%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm"
                  : "mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
              }
            >
              {typeof m.content === "string" ? (
                m.content
              ) : (
                <div>
                  <div className="font-semibold mb-1">{m.content.title}</div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{m.content.markdown}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="mr-auto rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Consultando…
            </div>
          )}
          <div ref={endRef} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <Button
            key={s}
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => send(s)}
            disabled={loading}
          >
            {s}
          </Button>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex gap-2"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo sobre seu negócio..."
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
