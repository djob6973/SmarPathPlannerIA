import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sendChatMessage } from "@/lib/chat.functions";
import { useAuth } from "@/lib/auth-context";
import { getAreas } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Loader2, Bot, User, Sparkles, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/app/chat")({
  component: ChatPage,
});

type Message = { id: string; role: "user" | "assistant"; content: string; created_at: string };

const STARTERS = [
  "Necesito un sistema de gestión de inventarios para nuestra tienda.",
  "Quiero desarrollar una app móvil de seguimiento de hábitos.",
  "Necesito integrar pagos con Stripe en nuestro e-commerce.",
  "Queremos un dashboard de analítica para el equipo de ventas.",
];

function ChatPage() {
  const send = useServerFn(sendChatMessage);
  const { isSuperAdmin, areaId } = useAuth();
  const [convId, setConvId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      loadAreas();
    }
  }, [isSuperAdmin]);

  const loadAreas = async () => {
    const { areas: data } = await getAreas();
    setAreas(data);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content, created_at: new Date().toISOString() }]);
    setBusy(true);
    try {
      const effectiveAreaId = isSuperAdmin ? selectedArea : areaId;
      const res = await send({ data: { conversationId: convId, message: content, selectedAreaId: effectiveAreaId } });
      if ((res as any).error) {
        toast.error((res as any).error);
        setMessages((m) => m.slice(0, -1));
      } else {
        setConvId(res.conversationId);
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", content: res.assistant!, created_at: new Date().toISOString() },
        ]);
        if (res.createdRequestId) {
          toast.success("Solicitud registrada en el roadmap", { description: "Puedes verla en el Tablero o Solicitudes." });
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Error al enviar mensaje");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const reset = () => { setConvId(undefined); setMessages([]); };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col max-w-3xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Agente IA</h1>
            <p className="text-xs text-muted-foreground">Captura de solicitudes inteligente</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Select value={selectedArea || "all"} onValueChange={(value) => setSelectedArea(value === "all" ? null : value)}>
              <SelectTrigger className="w-48 h-7 text-xs">
                <SelectValue placeholder="Área: Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!isEmpty && (
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-xs h-7">
              <RotateCcw className="h-3 w-3" /> Nueva conversación
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">¿Qué proyecto necesitas?</h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Cuéntame tu idea. Te haré preguntas para estructurarla y la registraré en el roadmap automáticamente.
              </p>
            </div>
            <div className="grid gap-2 w-full max-w-md">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm text-left hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-card border border-border/50 rounded-tl-sm"
              )}
            >
              {m.role === "assistant" ? (
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                    li: ({ children }) => <li className="ml-2">{children}</li>,
                    p: ({ children }) => <p className="my-1">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              ) : (
                m.content
              )}
            </div>
            {m.role === "user" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex gap-3 justify-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 mt-0.5">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-card border border-border/50 px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="py-4 border-t border-border/50">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Escribe tu mensaje... (Enter para enviar, Shift+Enter para salto de línea)"
            className="min-h-[52px] max-h-60 resize-y text-sm"
            disabled={busy}
          />
          <Button
            onClick={() => submit()}
            disabled={busy || !input.trim()}
            size="icon"
            className="h-[52px] w-[52px] shrink-0"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
