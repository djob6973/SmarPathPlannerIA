import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sendChatMessage } from "@/lib/chat.functions";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { translations } from "@/locales/translations";
import { getAreas } from "@/lib/data.functions";
import { toast } from "sonner";
import { Bot, User, ArrowRight, Loader2, Sparkles, RotateCcw, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/app/chat")({
  component: ChatPage,
});

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  requestCreated?: boolean;
};

const STARTERS = [
  "Necesito un sistema de evaluación interactivo.",
];

function ChatPage() {
  const { hasPermission } = useAuth();
  const { t } = useLang();
  if (!hasPermission("use_ai_features")) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{t("common.noAccess")}</p>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{t("chat.noPermission")}</p>
      </div>
    );
  }
  return <ChatPageContent />;
}

function ChatPageContent() {
  const send = useServerFn(sendChatMessage);
  const { isSuperAdmin, areaId, areaName } = useAuth();
  const { t } = useLang();
  const [convId, setConvId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isSuperAdmin) loadAreas();
  }, [isSuperAdmin]);

  const loadAreas = async () => {
    const { areas: data } = await getAreas();
    setAreas(data);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const submit = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", content, created_at: new Date().toISOString() },
    ]);
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
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: res.assistant!,
            created_at: new Date().toISOString(),
            requestCreated: !!res.createdRequestId,
          },
        ]);
      }
    } catch (e: any) {
      toast.error(e?.message ?? t("chat.sendError"));
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const reset = () => { setConvId(undefined); setMessages([]); };

  const isEmpty = messages.length === 0;
  const displayAreaName = isSuperAdmin
    ? (areas.find((a) => a.id === selectedArea)?.name ?? t("chat.allAreas"))
    : (areaName ?? t("chat.myArea"));

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", maxWidth: 820, margin: "0 auto",
      padding: "0 24px", animation: "spIn .35s ease both",
    }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "24px 0 20px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: "rgba(237,86,80,.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bot size={20} style={{ color: "#ED5650" }} />
          </div>
          <div>
            <h1 style={{
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
              fontSize: 22, fontWeight: 500,
              color: "var(--foreground)",
              margin: 0, lineHeight: 1.2,
            }}>
              {t("chat.title")}
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
              {t("chat.captureSubtitle")} · {displayAreaName}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isSuperAdmin && (
            <select
              value={selectedArea ?? "all"}
              onChange={(e) => setSelectedArea(e.target.value === "all" ? null : e.target.value)}
              style={selectStyle}
            >
              <option value="all">{t("common.allAreas")}</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {!isEmpty && (
            <button onClick={reset} style={ghostBtnStyle}>
              <RotateCcw size={13} /> {t("chat.newConversation")}
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "24px 0",
        display: "flex", flexDirection: "column", gap: 18,
      }}>
        {isEmpty ? (
          <EmptyState onStarter={submit} />
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        {busy && <ThinkingBubble />}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div style={{ flexShrink: 0, paddingBottom: 24 }}>
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-card, 20px)",
          padding: "10px 10px 10px 16px",
          display: "flex", gap: 10, alignItems: "flex-end",
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder={t("chat.inputPlaceholder")}
            disabled={busy}
            rows={1}
            style={{
              flex: 1, border: "none", background: "transparent", outline: "none",
              resize: "none", fontSize: 14, lineHeight: 1.6,
              color: "var(--foreground)", minHeight: 44, maxHeight: 160,
              padding: "10px 0", fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => submit()}
            disabled={busy || !input.trim()}
            style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: "#ED5650", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: busy || !input.trim() ? 0.4 : 1,
              transition: "opacity 150ms",
              marginBottom: 2,
            }}
          >
            {busy ? (
              <Loader2 size={16} style={{ color: "white" }} className="animate-spin" />
            ) : (
              <ArrowRight size={16} style={{ color: "white" }} />
            )}
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", marginTop: 8 }}>
          {t("chat.shiftEnter")}
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────

function MessageBubble({ message: m }: { message: Message }) {
  const { t } = useLang();
  const isUser = m.role === "user";
  return (
    <div style={{ display: "flex", gap: 11, justifyContent: isUser ? "flex-end" : "flex-start" }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: "rgba(237,86,80,.1)",
          display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
        }}>
          <Bot size={14} style={{ color: "#ED5650" }} />
        </div>
      )}

      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 8 }}>
        {m.requestCreated && (
          <div style={{
            background: "rgba(237,86,80,.08)",
            border: "1px solid rgba(237,86,80,.2)",
            borderRadius: "var(--r-card, 20px)",
            padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: "#ED5650",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CheckCircle2 size={14} style={{ color: "white" }} />
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#ED5650", margin: 0 }}>
                {t("chat.requestCreated")}
              </p>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
                {t("chat.requestCreatedSub")}
              </p>
            </div>
          </div>
        )}

        <div style={{
          background: isUser ? "#ED5650" : "var(--card)",
          border: isUser ? "none" : "1px solid var(--border)",
          borderRadius: "var(--r-xl, 16px)",
          ...(isUser ? { borderTopRightRadius: 4 } : { borderTopLeftRadius: 4 }),
          padding: "12px 16px",
          fontSize: 14, lineHeight: 1.65,
          color: isUser ? "white" : "var(--foreground)",
        }}>
          {isUser ? (
            <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
          ) : (
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 style={{ fontSize: 16, fontWeight: 700, margin: "10px 0 4px" }}>{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px" }}>{children}</h2>
                ),
                ul: ({ children }) => (
                  <ul style={{ paddingLeft: 20, margin: "6px 0" }}>{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ paddingLeft: 20, margin: "6px 0" }}>{children}</ol>
                ),
                li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                p: ({ children }) => <p style={{ margin: "3px 0" }}>{children}</p>,
                strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                code: ({ children }) => (
                  <code style={{
                    background: "var(--muted)", padding: "1px 6px",
                    borderRadius: 4, fontSize: 12, fontFamily: "monospace",
                  }}>
                    {children}
                  </code>
                ),
              }}
            >
              {m.content}
            </ReactMarkdown>
          )}
        </div>
      </div>

      {isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: "var(--muted)",
          display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
        }}>
          <User size={14} style={{ color: "var(--muted-foreground)" }} />
        </div>
      )}
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div style={{ display: "flex", gap: 11 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: "rgba(237,86,80,.1)",
        display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
      }}>
        <Bot size={14} style={{ color: "#ED5650" }} />
      </div>
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl, 16px)", borderTopLeftRadius: 4,
        padding: "14px 18px",
        display: "flex", alignItems: "center", gap: 5,
      }}>
        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function EmptyState({ onStarter }: { onStarter: (s: string) => void }) {
  const { lang } = useLang();
  const starterList = translations[lang].chat.starters;
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 24, padding: "40px 0", textAlign: "center",
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: "50%",
        background: "rgba(237,86,80,.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Sparkles size={28} style={{ color: "#ED5650" }} />
      </div>
      <div>
        <h2 style={{
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
          fontSize: 20, fontWeight: 500, margin: 0,
          color: "var(--foreground)",
        }}>
          ¿Qué proyecto necesitas?
        </h2>
        <p style={{
          fontSize: 14, color: "var(--muted-foreground)",
          margin: "8px auto 0", maxWidth: 400,
        }}>
          Cuéntame tu idea. Te haré preguntas para estructurarla y la registraré en el roadmap automáticamente.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: "100%" }}>
        {starterList.map((s) => (
          <StarterButton key={s} text={s} onClick={() => onStarter(s)} />
        ))}
      </div>
    </div>
  );
}

function StarterButton({ text, onClick }: { text: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "11px 18px",
        borderRadius: "var(--r-xl, 16px)",
        border: hovered ? "1px solid rgba(237,86,80,.5)" : "1px solid var(--border)",
        background: hovered ? "rgba(237,86,80,.04)" : "var(--card)",
        color: "var(--foreground)",
        fontSize: 13, textAlign: "left" as const,
        cursor: "pointer", transition: "border-color 120ms, background 120ms",
      }}
    >
      {text}
    </button>
  );
}

// ── Shared styles ────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  height: 40, padding: "0 14px",
  borderRadius: "var(--r-xl, 16px)",
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 13, cursor: "pointer", outline: "none",
};

const ghostBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  height: 36, padding: "0 14px",
  borderRadius: "var(--r-xl, 16px)",
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted-foreground)",
  fontSize: 13, fontWeight: 500, cursor: "pointer",
  whiteSpace: "nowrap",
};
