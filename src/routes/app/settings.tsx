import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listAreas, updateUserOwnArea } from "@/lib/admin.functions";
import { changeOwnPassword } from "@/lib/auth.functions";
import { getColumns, createColumn, updateColumn, deleteColumn, getAiSettings, updateAiSettings } from "@/lib/data.functions";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Settings, Columns3, Bot, GripVertical, Plus, Trash2, Save,
  Pencil, Check, X, Lock, Shield, Building, User,
} from "lucide-react";
import { PermissionsManager } from "@/components/admin/permissions-manager";
import { AreasManager } from "@/components/admin/areas-manager";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type Column    = { id: string; name: string; position: number; color: string; is_completed: boolean };
type EditState = { id: string; name: string; color: string } | null;
type Tab       = "columns" | "ai" | "permissions" | "areas" | "profile";

// ── Shared card style ─────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card, 20px)",
  overflow: "hidden",
};

// ── Page ─────────────────────────────────────────────────────────────────────

function SettingsPage() {
  const { roles } = useAuth();
  const [tab, setTab] = useState<Tab>("columns");

  const roleStrings = roles.map(r => typeof r === 'object' && r !== null && 'role' in r ? (r as any).role : r);
  const hasSuperAdmin = roleStrings.includes("super_admin");

  if (!hasSuperAdmin) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        height: "100%", gap: 12,
        animation: "spIn .35s ease both",
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "var(--muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Lock size={22} style={{ color: "var(--muted-foreground)" }} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
          Acceso restringido
        </p>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
          Solo los super administradores pueden acceder a la configuración.
        </p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }[] = [
    { key: "columns",     label: "Columnas Kanban", Icon: Columns3 },
    { key: "ai",          label: "Agente IA",       Icon: Bot      },
    { key: "permissions", label: "Permisos",        Icon: Shield   },
    { key: "areas",       label: "Áreas",           Icon: Building },
    { key: "profile",     label: "Mi Perfil",       Icon: User     },
  ];

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
            Configuración
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "3px 0 0" }}>
            Personaliza el tablero, agente IA, permisos y áreas
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
      {tab === "permissions" && <PermissionsManager />}
      {tab === "areas"       && <AreasManager />}
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

// ── Profile settings ──────────────────────────────────────────────────────────

function ProfileSettings() {
  const { profile } = useAuth();
  const { data: areasData, isLoading: areasLoading } = useQuery({
    queryKey: ["areas"],
    queryFn: () => listAreas(),
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

      {/* Area */}
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
