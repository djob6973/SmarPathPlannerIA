import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAreas, updateUserOwnArea } from "@/lib/admin.functions";
import { changeOwnPassword } from "@/lib/auth.functions";
import { getPlatformSetting, setPlatformSetting } from "@/lib/settings.functions";
import { getColumns, createColumn, updateColumn, deleteColumn, getAiSettings, updateAiSettings } from "@/lib/data.functions";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Settings, Columns3, Bot, GripVertical, Plus, Trash2, Save,
  Pencil, Check, X, Lock, Shield, Building, User, Palette, Upload, Bell,
} from "lucide-react";
import { getSlackConfig, saveSlackConfig, testSlackConfig } from "@/lib/slack.functions";
import { PermissionsManager } from "@/components/admin/permissions-manager";
import { AreasManager } from "@/components/admin/areas-manager";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type Column    = { id: string; name: string; position: number; color: string; is_completed: boolean };
type EditState = { id: string; name: string; color: string } | null;
type Tab       = "columns" | "ai" | "permissions" | "areas" | "profile" | "branding" | "slack";

// ── Shared card style ─────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card, 20px)",
  overflow: "hidden",
};

// ── Page ─────────────────────────────────────────────────────────────────────

function SettingsPage() {
  const { isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>(isSuperAdmin ? "columns" : "profile");

  const allTabs: { key: Tab; label: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }[] = [
    { key: "columns",     label: "Columnas Kanban", Icon: Columns3 },
    { key: "ai",          label: "Agente IA",       Icon: Bot      },
    { key: "slack",       label: "Slack",           Icon: Bell     },
    { key: "permissions", label: "Permisos",        Icon: Shield   },
    { key: "areas",       label: "Áreas",           Icon: Building },
    { key: "branding",    label: "Marca",           Icon: Palette  },
    { key: "profile",     label: "Mi Perfil",       Icon: User     },
  ];

  const tabs = isSuperAdmin ? allTabs : allTabs.filter(t => t.key === "profile");

  return (
    <div style={{
      padding: "36px 40px 64px",
      maxWidth: 1100, margin: "0 auto",
      animation: "spIn .35s ease both",
    }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
          background: "rgba(237,86,80,.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Settings size={22} style={{ color: "#ED5650" }} />
        </div>
        <div>
          <h1 style={{
            fontFamily: "var(--font-display,'Space Grotesk',sans-serif)",
            fontSize: 24, fontWeight: 600,
            color: "var(--foreground)",
            margin: 0, lineHeight: 1.2,
          }}>
            {isSuperAdmin ? "Configuración" : "Mi Perfil"}
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "3px 0 0" }}>
            {isSuperAdmin ? "Personaliza el tablero, agente IA, permisos y áreas" : "Gestiona tu información personal y contraseña"}
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 28 }}>
        {tabs.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 16px",
                borderRadius: "var(--r-pill, 999px)",
                border: active ? "none" : "1px solid var(--border)",
                background: active ? "#ED5650" : "var(--card)",
                color: active ? "white" : "var(--muted-foreground)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "all 120ms",
                whiteSpace: "nowrap" as const,
              }}
            >
              <Icon size={14} style={{ color: active ? "white" : "var(--muted-foreground)" }} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      {tab === "columns"     && <ColumnsSettings />}
      {tab === "ai"          && <AISettings />}
      {tab === "slack"       && <SlackSettings />}
      {tab === "permissions" && <PermissionsManager />}
      {tab === "areas"       && <AreasManager />}
      {tab === "branding"    && <BrandingSettings />}
      {tab === "profile"     && <ProfileSettings />}
    </div>
  );
}

// ── Columns settings ──────────────────────────────────────────────────────────

function SortableColumnRow({
  c, editing, setEditing, onSaveEdit, onToggleCompleted, onRemove,
}: {
  c: Column;
  editing: EditState;
  setEditing: React.Dispatch<React.SetStateAction<EditState>>;
  onSaveEdit: () => void;
  onToggleCompleted: (id: string, val: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const isEditing = editing?.id === c.id;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 18px",
        borderBottom: "1px solid var(--border)",
        background: isDragging ? "var(--muted)" : "transparent",
        transition: "background 120ms",
      }}
    >
      <button
        {...attributes}
        {...listeners}
        tabIndex={-1}
        style={{ cursor: "grab", background: "none", border: "none", padding: 0, flexShrink: 0 }}
        aria-label="Reordenar"
      >
        <GripVertical size={16} style={{ color: "var(--border)" }} />
      </button>

      {isEditing ? (
        <>
          <input
            type="color"
            value={editing!.color}
            onChange={(e) => setEditing((p) => p ? { ...p, color: e.target.value } : p)}
            style={{
              width: 28, height: 28, cursor: "pointer",
              borderRadius: "50%", border: "2px solid var(--border)",
              background: "none", padding: 0, flexShrink: 0,
            }}
          />
          <input
            value={editing!.name}
            onChange={(e) => setEditing((p) => p ? { ...p, name: e.target.value } : p)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit();
              if (e.key === "Escape") setEditing(null);
            }}
            style={{
              flex: 1, height: 32,
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md, 10px)",
              background: "var(--muted)",
              color: "var(--foreground)",
              padding: "0 10px",
              fontSize: 13, outline: "none",
            }}
          />
          <button
            onClick={onSaveEdit}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "rgba(157,221,5,.15)", border: "none",
              color: "#7AAE1B", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Check size={13} />
          </button>
          <button
            onClick={() => setEditing(null)}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "var(--muted)", border: "none",
              color: "var(--muted-foreground)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={13} />
          </button>
        </>
      ) : (
        <>
          <span style={{
            width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
            background: c.color,
            boxShadow: `0 0 0 3px ${c.color}22`,
          }} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>
            {c.name}
          </span>
          <label style={{
            display: "flex", alignItems: "center", gap: 7,
            fontSize: 12, color: "var(--muted-foreground)",
            cursor: "pointer", userSelect: "none",
          }}>
            <Switch
              checked={c.is_completed}
              onCheckedChange={(v) => onToggleCompleted(c.id, v)}
              className="scale-75"
            />
            Completado
          </label>
          <button
            onClick={() => setEditing({ id: c.id, name: c.name, color: c.color })}
            style={{
              width: 28, height: 28, borderRadius: "var(--r-md, 10px)",
              background: "var(--muted)", border: "none",
              color: "var(--muted-foreground)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            aria-label="Editar columna"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => onRemove(c.id)}
            style={{
              width: 28, height: 28, borderRadius: "var(--r-md, 10px)",
              background: "rgba(237,86,80,.08)", border: "none",
              color: "#ED5650", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            aria-label="Eliminar columna"
          >
            <Trash2 size={12} />
          </button>
        </>
      )}
    </div>
  );
}

export function ColumnsSettings() {
  const [cols, setCols]       = useState<Column[]>([]);
  const [name, setName]       = useState("");
  const [color, setColor]     = useState("#6366F1");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const reload = async () => {
    const { columns: data } = await getColumns({ data: {} });
    setCols(data as Column[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const add = async () => {
    if (!name.trim()) { toast.error("El nombre es requerido"); return; }
    const nextPos = cols.length > 0 ? Math.max(...cols.map((c) => c.position)) + 1 : 0;
    try {
      await createColumn({ data: { name: name.trim(), color, position: nextPos } });
      toast.success("Columna añadida"); setName(""); reload();
    } catch (err: any) { toast.error(err?.message); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta columna? Las solicitudes en ella quedarán sin estado.")) return;
    try {
      await deleteColumn({ data: { id } });
      toast.success("Columna eliminada"); reload();
    } catch (err: any) { toast.error(err?.message); }
  };

  const toggleCompleted = async (id: string, val: boolean) => {
    try {
      await updateColumn({ data: { id, is_completed: val } });
      reload();
    } catch (err: any) { toast.error(err?.message); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("El nombre es requerido"); return; }
    try {
      await updateColumn({ data: { id: editing.id, name: editing.name.trim(), color: editing.color } });
      toast.success("Columna actualizada"); setEditing(null); reload();
    } catch (err: any) { toast.error(err?.message); }
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = cols.findIndex((c) => c.id === active.id);
    const newIndex = cols.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(cols, oldIndex, newIndex);
    setCols(reordered);
    try {
      await Promise.all(reordered.map((c, i) => updateColumn({ data: { id: c.id, position: i } })));
    } catch {
      toast.error("Error al reordenar columnas");
      reload();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* New column form */}
      <div style={cardStyle}>
        <div style={{ padding: "18px 20px" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: "0 0 12px" }}>
            Nueva columna
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Nombre de la columna"
              style={{
                flex: 1, height: 38,
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md, 10px)",
                background: "var(--muted)",
                color: "var(--foreground)",
                padding: "0 12px",
                fontSize: 13, outline: "none",
              }}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: 38, height: 38, cursor: "pointer",
                borderRadius: "var(--r-md, 10px)",
                border: "1px solid var(--border)",
                background: "none", padding: 2, flexShrink: 0,
              }}
              title="Color"
            />
            <button
              onClick={add}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                height: 38, padding: "0 16px",
                borderRadius: "var(--r-md, 10px)",
                background: "#ED5650", border: "none",
                color: "white", fontSize: 13, fontWeight: 500,
                cursor: "pointer", flexShrink: 0,
              }}
            >
              <Plus size={14} /> Añadir
            </button>
          </div>
        </div>
      </div>

      {/* Columns list */}
      <div style={cardStyle}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
            Columnas actuales
          </p>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {cols.length} columnas
          </span>
        </div>

        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{
            display: "flex", gap: 12, padding: "13px 18px",
            borderBottom: "1px solid var(--border)",
          }}>
            <div className="animate-pulse" style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--muted)" }} />
            <div className="animate-pulse" style={{ flex: 1, height: 16, borderRadius: 8, background: "var(--muted)" }} />
          </div>
        ))}

        {!loading && cols.length === 0 && (
          <p style={{ padding: "32px 20px", textAlign: "center", fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
            Sin columnas. Añade la primera arriba.
          </p>
        )}

        {!loading && cols.length > 0 && (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={cols.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {cols.map((c) => (
                <SortableColumnRow
                  key={c.id}
                  c={c}
                  editing={editing}
                  setEditing={setEditing}
                  onSaveEdit={saveEdit}
                  onToggleCompleted={toggleCompleted}
                  onRemove={remove}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}

        {!loading && cols.length > 0 && (
          <div style={{ padding: "10px 18px", background: "var(--muted)" }}>
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>
              Arrastra las filas para reordenar · El switch <strong>Completado</strong> marca columnas que cierran solicitudes en analítica
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI settings ───────────────────────────────────────────────────────────────

const PRESET_MODELS = [
  { value: "gpt-4o-mini",   label: "GPT-4o Mini"   },
  { value: "gpt-4o",        label: "GPT-4o"         },
  { value: "gpt-4-turbo",   label: "GPT-4 Turbo"   },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

function AISettings() {
  const [id, setId]               = useState<string | null>(null);
  const [prompt, setPrompt]       = useState("");
  const [model, setModel]         = useState("gpt-4o-mini");
  const [questions, setQuestions] = useState("");
  const [temperature, setTemp]    = useState(0.7);
  const [maxTokens, setMaxTokens] = useState("4096");
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    getAiSettings({ data: {} }).then(({ settings }) => {
      if (settings) {
        setId(settings.id ?? null);
        setPrompt(settings.system_prompt ?? "");
        setModel(settings.model ?? "gpt-4o-mini");
        setQuestions(((settings.intake_questions ?? []) as string[]).join("\n"));
        setTemp(settings.temperature ?? 0.7);
        setMaxTokens(String(settings.max_tokens ?? 4096));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await updateAiSettings({ data: {
        ...(id ? { id } : {}),
        system_prompt:    prompt.trim(),
        model:            model.trim(),
        intake_questions: questions.split("\n").map((s) => s.trim()).filter(Boolean),
      }});
      toast.success("Configuración guardada");
    } catch (err: any) { toast.error(err?.message); }
    setSaving(false);
  };

  const subLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600,
    textTransform: "uppercase" as const, letterSpacing: "0.06em",
    color: "var(--muted-foreground)", margin: "0 0 8px", display: "block",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse" style={{ height: 120, borderRadius: "var(--r-card, 20px)", background: "var(--muted)" }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Model & parameters */}
      <div style={cardStyle}>
        <div style={{ padding: "20px 22px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: "0 0 18px" }}>
            Modelo y parámetros
          </p>

          <span style={subLabel}>Modelo</span>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginBottom: 12 }}>
            {PRESET_MODELS.map((m) => {
              const active = model === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => setModel(m.value)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "var(--r-pill, 999px)",
                    border: active ? "none" : "1px solid var(--border)",
                    background: active ? "#ED5650" : "var(--muted)",
                    color: active ? "white" : "var(--muted-foreground)",
                    fontSize: 12, fontWeight: 500, cursor: "pointer",
                    transition: "all 120ms",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Modelo personalizado, ej: o3-mini"
            style={{
              width: "100%", height: 36, boxSizing: "border-box" as const,
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md, 10px)",
              background: "var(--muted)",
              color: "var(--foreground)",
              padding: "0 12px",
              fontSize: 12, outline: "none",
            }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={subLabel}>Temperatura</span>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "monospace", color: "var(--foreground)" }}>
                  {temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[temperature]}
                onValueChange={([v]) => setTemp(v)}
                min={0} max={2} step={0.1}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Preciso</span>
                <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Balanceado</span>
                <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Creativo</span>
              </div>
            </div>

            <div>
              <span style={subLabel}>Tokens máximos</span>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                min={1}
                max={128000}
                style={{
                  width: "100%", height: 38, boxSizing: "border-box" as const,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md, 10px)",
                  background: "var(--muted)",
                  color: "var(--foreground)",
                  padding: "0 12px",
                  fontSize: 13, outline: "none",
                }}
              />
              <p style={{ fontSize: 10, color: "var(--muted-foreground)", margin: "6px 0 0" }}>
                GPT-4o soporta hasta 128 000 tokens
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* System prompt */}
      <div style={cardStyle}>
        <div style={{ padding: "20px 22px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: "0 0 12px" }}>
            Prompt del sistema
          </p>
          <textarea
            rows={10}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Eres un agente de intake de proyectos. Tu objetivo es..."
            style={{
              width: "100%", boxSizing: "border-box" as const,
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md, 10px)",
              background: "var(--muted)",
              color: "var(--foreground)",
              padding: "12px 14px",
              fontSize: 13, resize: "vertical" as const,
              fontFamily: "monospace", outline: "none",
              lineHeight: 1.6,
            }}
          />
        </div>
      </div>

      {/* Intake questions */}
      <div style={cardStyle}>
        <div style={{ padding: "20px 22px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
            Preguntas guía
          </p>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "4px 0 12px" }}>
            Una por línea. El agente las usa para estructurar la conversación de intake.
          </p>
          <textarea
            rows={6}
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            placeholder={"¿Cuál es el objetivo principal del proyecto?\n¿Quiénes son los usuarios finales?\n¿Cuál es el plazo estimado?"}
            style={{
              width: "100%", boxSizing: "border-box" as const,
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md, 10px)",
              background: "var(--muted)",
              color: "var(--foreground)",
              padding: "12px 14px",
              fontSize: 13, resize: "vertical" as const,
              fontFamily: "monospace", outline: "none",
              lineHeight: 1.6,
            }}
          />
        </div>
      </div>

      {/* Save bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 0",
      }}>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
          Requiere{" "}
          <code style={{ fontFamily: "monospace", background: "var(--muted)", padding: "1px 5px", borderRadius: 4 }}>
            OPENAI_API_KEY
          </code>{" "}
          configurada en el servidor.
        </p>
        <button
          onClick={save}
          disabled={saving}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            height: 38, padding: "0 18px",
            borderRadius: "var(--r-md, 10px)",
            background: saving ? "var(--muted)" : "#ED5650",
            border: "none",
            color: saving ? "var(--muted-foreground)" : "white",
            fontSize: 13, fontWeight: 500,
            cursor: saving ? "not-allowed" : "pointer",
            transition: "background 120ms",
          }}
        >
          {saving
            ? <span className="animate-spin" style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block" }} />
            : <Save size={14} />
          }
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

// ── Slack settings ────────────────────────────────────────────────────────────

function SlackIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.521-10.123a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.123 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.123a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

function SlackSettings() {
  const [enabled,     setEnabled]     = useState(false);
  const [autoNotify,  setAutoNotify]  = useState(false);
  const [channel,     setChannel]     = useState("");
  const [hasToken,    setHasToken]    = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [testing,     setTesting]     = useState(false);

  useEffect(() => {
    getSlackConfig({ data: undefined as any }).then(({ config, hasToken: ht }) => {
      setEnabled(config.enabled);
      setAutoNotify(config.auto_notify);
      setChannel(config.channel);
      setHasToken(ht);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await saveSlackConfig({ data: { enabled, auto_notify: autoNotify, channel: channel.trim() } });
      toast.success("Configuración de Slack guardada");
    } catch (err: any) { toast.error(err?.message); }
    setSaving(false);
  };

  const test = async () => {
    if (!channel.trim()) { toast.error("Introduce un ID de canal antes de probar"); return; }
    setTesting(true);
    try {
      await testSlackConfig({ data: { channel: channel.trim() } });
      toast.success("¡Mensaje de prueba enviado correctamente!");
    } catch (err: any) { toast.error(err?.message); }
    setTesting(false);
  };

  const subLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600,
    textTransform: "uppercase" as const, letterSpacing: "0.06em",
    color: "var(--muted-foreground)", margin: "0 0 8px", display: "block",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse" style={{ height: 120, borderRadius: "var(--r-card, 20px)", background: "var(--muted)" }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Status card */}
      <div style={cardStyle}>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "rgba(74,21,75,.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <SlackIcon size={18} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                Notificaciones a Slack
              </p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "3px 0 0" }}>
                Envía un mensaje al completar una solicitud
              </p>
            </div>
          </div>

          {/* Token status */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            borderRadius: "var(--r-md, 10px)",
            background: hasToken ? "rgba(34,197,94,.08)" : "rgba(237,86,80,.08)",
            border: `1px solid ${hasToken ? "rgba(34,197,94,.2)" : "rgba(237,86,80,.2)"}`,
            marginBottom: 18,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: hasToken ? "#22c55e" : "#ED5650",
            }} />
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
                SLACK_BOT_TOKEN
              </span>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: 8 }}>
                {hasToken ? "Configurado ✓" : "No configurado — agrega la variable de entorno"}
              </span>
            </div>
          </div>

          {/* Enable toggle */}
          <label style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 0",
            borderBottom: "1px solid var(--border)",
            cursor: "pointer",
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", margin: 0 }}>
                Activar integración
              </p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
                Habilita el botón "Notificar a Slack" en las solicitudes completadas
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={!hasToken}
            />
          </label>

          {/* Auto-notify toggle */}
          <label style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 0",
            cursor: "pointer",
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", margin: 0 }}>
                Notificación automática
              </p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
                Notifica automáticamente al mover una tarjeta a columna completada
              </p>
            </div>
            <Switch
              checked={autoNotify}
              onCheckedChange={setAutoNotify}
              disabled={!hasToken || !enabled}
            />
          </label>
        </div>
      </div>

      {/* Channel config */}
      <div style={cardStyle}>
        <div style={{ padding: "18px 22px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: "0 0 16px" }}>
            Canal de destino
          </p>

          <span style={subLabel}>ID del canal</span>
          <input
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="C1234567890  ó  #nombre-del-canal"
            disabled={!hasToken}
            style={{
              width: "100%", height: 38, boxSizing: "border-box" as const,
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md, 10px)",
              background: "var(--muted)",
              color: "var(--foreground)",
              padding: "0 12px",
              fontSize: 13, outline: "none",
              opacity: hasToken ? 1 : 0.5,
            }}
          />
          <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "6px 0 0" }}>
            Copia el ID desde Slack: clic derecho en el canal → <em>Ver detalles del canal</em> → ID al final.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
        <button
          onClick={test}
          disabled={testing || !hasToken || !channel.trim()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            height: 38, padding: "0 18px",
            borderRadius: "var(--r-md, 10px)",
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: (!hasToken || !channel.trim()) ? "var(--muted-foreground)" : "var(--foreground)",
            fontSize: 13, fontWeight: 500,
            cursor: (!hasToken || !channel.trim() || testing) ? "not-allowed" : "pointer",
          }}
        >
          {testing
            ? <span className="animate-spin" style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block" }} />
            : <SlackIcon size={14} />
          }
          Probar conexión
        </button>

        <button
          onClick={save}
          disabled={saving || !hasToken}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            height: 38, padding: "0 18px",
            borderRadius: "var(--r-md, 10px)",
            background: (saving || !hasToken) ? "var(--muted)" : "#ED5650",
            border: "none",
            color: (saving || !hasToken) ? "var(--muted-foreground)" : "white",
            fontSize: 13, fontWeight: 500,
            cursor: (saving || !hasToken) ? "not-allowed" : "pointer",
            transition: "background 120ms",
          }}
        >
          {saving
            ? <span className="animate-spin" style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block" }} />
            : <Save size={14} />
          }
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

// ── Branding settings ─────────────────────────────────────────────────────────

const LOGO_KEY = "logo_url";
const MAX_BYTES = 500 * 1024; // 500 KB

function BrandingSettings() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dropHover, setDropHover] = useState(false);

  const { data: logoData, isLoading } = useQuery({
    queryKey: ["platform-setting", LOGO_KEY],
    queryFn:  () => getPlatformSetting({ data: { key: LOGO_KEY } }),
  });

  const currentLogo = logoData?.value ?? null;

  const saveMutation = useMutation({
    mutationFn: (value: string | null) =>
      setPlatformSetting({ data: { key: LOGO_KEY, value } }),
    onSuccess: (_r, value) => {
      toast.success(value ? "Logo actualizado correctamente" : "Logo eliminado");
      queryClient.invalidateQueries({ queryKey: ["platform-setting", LOGO_KEY] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al guardar el logo"),
  });

  const processFile = (file: File) => {
    if (file.size > MAX_BYTES) { toast.error("El archivo no puede superar 500 KB"); return; }
    const reader = new FileReader();
    reader.onload = () => saveMutation.mutate(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropHover(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const busy = saveMutation.isPending || isLoading;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={cardStyle}>
        <div style={{ padding: "20px 22px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "var(--muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Palette size={18} style={{ color: "var(--muted-foreground)" }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                Identidad visual
              </p>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "3px 0 0" }}>
                El logo aparecerá en el menú lateral del sistema
              </p>
            </div>
          </div>

          {/* Drop zone */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={handleInputChange}
            style={{ display: "none" }}
          />
          <div
            onClick={() => !busy && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDropHover(true); }}
            onDragLeave={() => setDropHover(false)}
            onDrop={handleDrop}
            style={{
              width: "100%", minHeight: 160,
              border: `1.5px dashed ${dropHover ? "#ED5650" : "var(--border)"}`,
              borderRadius: "var(--r-md, 12px)",
              background: dropHover ? "rgba(237,86,80,.06)" : "var(--muted)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 10, marginBottom: 16,
              cursor: busy ? "default" : "pointer",
              transition: "border-color 150ms, background 150ms",
              overflow: "hidden",
            }}
          >
            {busy && !currentLogo ? (
              <span style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--muted-foreground)", borderTopColor: "transparent", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
            ) : currentLogo ? (
              <img
                src={currentLogo}
                alt="Logo actual"
                style={{ maxHeight: 120, maxWidth: "90%", objectFit: "contain" }}
              />
            ) : (
              <>
                {/* Image placeholder icon */}
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted-foreground)" }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", margin: 0, textAlign: "center" }}>
                  Haz clic para seleccionar imagen
                </p>
                <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
                  PNG, JPG, SVG · máx 500 KB
                </p>
              </>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                height: 38, padding: "0 18px",
                borderRadius: "var(--r-md, 10px)",
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: busy ? "var(--muted-foreground)" : "var(--foreground)",
                fontSize: 13, fontWeight: 500,
                cursor: busy ? "not-allowed" : "pointer",
                transition: "border-color 120ms",
              }}
            >
              {saveMutation.isPending
                ? <span style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                : <Upload size={14} />
              }
              Seleccionar logo
            </button>

            {currentLogo && (
              <button
                onClick={() => saveMutation.mutate(null)}
                disabled={busy}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  height: 38, padding: "0 18px",
                  borderRadius: "var(--r-md, 10px)",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--muted-foreground)",
                  fontSize: 13, fontWeight: 500,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                <Trash2 size={14} />
                Eliminar
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Profile settings ──────────────────────────────────────────────────────────

function ProfileSettings() {
  const { profile, isSuperAdmin } = useAuth();
  const { data: areasData, isLoading: areasLoading } = useQuery({
    queryKey: ["areas"],
    queryFn: () => listAreas(),
    enabled: isSuperAdmin,
  });

  const updateAreaMutation = useMutation({
    mutationFn: updateUserOwnArea,
    onSuccess: () => {
      toast.success("Área actualizada exitosamente");
      window.location.reload();
    },
    onError: (error: any) => {
      toast.error(`Error al actualizar área: ${error.message}`);
    },
  });

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd]         = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const changePwdMutation = useMutation({
    mutationFn: changeOwnPassword,
    onSuccess: () => {
      toast.success("Contraseña actualizada correctamente");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    },
    onError: (error: any) => {
      toast.error(error.message ?? "Error al cambiar contraseña");
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { toast.error("Las contraseñas nuevas no coinciden"); return; }
    if (newPwd.length < 6) { toast.error("La nueva contraseña debe tener al menos 6 caracteres"); return; }
    changePwdMutation.mutate({ data: { currentPassword: currentPwd, newPassword: newPwd } });
  };

  const areas        = areasData?.areas || [];
  const currentAreaId = profile?.area_id || null;

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 38, boxSizing: "border-box" as const,
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md, 10px)",
    background: "var(--muted)",
    color: "var(--foreground)",
    padding: "0 12px",
    fontSize: 13, outline: "none",
  };

  const subLabelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600,
    textTransform: "uppercase" as const, letterSpacing: "0.06em",
    color: "var(--muted-foreground)", display: "block", marginBottom: 6,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Profile info */}
      <div style={cardStyle}>
        <div style={{ padding: "20px 22px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: "0 0 16px" }}>
            Información del perfil
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <span style={subLabelStyle}>Nombre</span>
              <p style={{ fontSize: 14, color: "var(--foreground)", margin: 0, padding: "6px 0" }}>
                {profile?.full_name || "No especificado"}
              </p>
            </div>
            <div>
              <span style={subLabelStyle}>Email</span>
              <p style={{ fontSize: 14, color: "var(--foreground)", margin: 0, padding: "6px 0" }}>
                {profile?.email || "No especificado"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Area — only super_admin can switch areas */}
      {isSuperAdmin && (
        <div style={cardStyle}>
          <div style={{ padding: "20px 22px" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: "0 0 4px" }}>
              Mi Área
            </p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 14px" }}>
              Selecciona el área organizacional a la que perteneces.
            </p>
            <Select
              value={currentAreaId || "none"}
              onValueChange={(value) => updateAreaMutation.mutate({ data: { areaId: value === "none" ? null : value } })}
              disabled={areasLoading || updateAreaMutation.isPending}
            >
              <SelectTrigger style={{ borderRadius: "var(--r-md, 10px)" }}>
                <SelectValue placeholder="Selecciona un área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin área</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentAreaId && (
              <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "8px 0 0" }}>
                Área actual:{" "}
                <strong style={{ color: "var(--foreground)" }}>
                  {areas.find((a) => a.id === currentAreaId)?.name || "Desconocida"}
                </strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Change password */}
      <div style={cardStyle}>
        <div style={{ padding: "20px 22px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: "0 0 16px" }}>
            Cambiar contraseña
          </p>
          <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label htmlFor="current-pwd" style={subLabelStyle}>Contraseña actual</label>
              <input
                id="current-pwd"
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                autoComplete="current-password"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="new-pwd" style={subLabelStyle}>Nueva contraseña</label>
              <input
                id="new-pwd"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="confirm-pwd" style={subLabelStyle}>Confirmar nueva contraseña</label>
              <input
                id="confirm-pwd"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
                autoComplete="new-password"
                style={inputStyle}
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={changePwdMutation.isPending}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  height: 38, padding: "0 18px",
                  borderRadius: "var(--r-md, 10px)",
                  background: changePwdMutation.isPending ? "var(--muted)" : "#ED5650",
                  border: "none",
                  color: changePwdMutation.isPending ? "var(--muted-foreground)" : "white",
                  fontSize: 13, fontWeight: 500,
                  cursor: changePwdMutation.isPending ? "not-allowed" : "pointer",
                }}
              >
                {changePwdMutation.isPending
                  ? <span className="animate-spin" style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block" }} />
                  : <Lock size={14} />
                }
                Cambiar contraseña
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
