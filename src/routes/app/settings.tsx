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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Settings, Columns3, Bot, GripVertical, Plus, Trash2, Save,
  Pencil, Check, X, Lock, Shield, Building, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PermissionsManager } from "@/components/admin/permissions-manager";
import { AreasManager } from "@/components/admin/areas-manager";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type Column   = { id: string; name: string; position: number; color: string; is_completed: boolean };
type EditState = { id: string; name: string; color: string } | null;
type Tab      = "columns" | "ai" | "permissions" | "areas" | "profile";

// ── Page ─────────────────────────────────────────────────────────────────────

function SettingsPage() {
  // AppLayout already shows a spinner while loading=true/unauthenticated,
  // so when this component renders, roles are populated.
  // Using a render-time guard (not useEffect+navigate) avoids the race condition.
  const { roles } = useAuth();
  const [tab, setTab] = useState<Tab>("columns");

  // Handle roles as objects or strings
  const roleStrings = roles.map(r => typeof r === 'object' && r !== null && 'role' in r ? r.role : r);
  const hasSuperAdmin = roleStrings.includes("super_admin");

  if (!hasSuperAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Acceso restringido</p>
        <p className="text-xs text-muted-foreground">
          Solo los super administradores pueden acceder a la configuración.
        </p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "columns", label: "Columnas Kanban", icon: Columns3 },
    { key: "ai",      label: "Agente IA",       icon: Bot      },
    { key: "permissions", label: "Permisos",      icon: Shield   },
    { key: "areas", label: "Áreas", icon: Building },
    { key: "profile", label: "Mi Perfil", icon: User },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestiona columnas del tablero y el agente IA
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "columns" && <ColumnsSettings />}
      {tab === "ai"      && <AISettings />}
      {tab === "permissions" && <PermissionsManager />}
      {tab === "areas" && <AreasManager />}
      {tab === "profile" && <ProfileSettings />}
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
      style={style}
      className={cn(
        "flex items-center gap-3 px-4 py-3 group hover:bg-muted/20 transition-colors",
        isDragging && "opacity-40"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        tabIndex={-1}
        className="cursor-grab active:cursor-grabbing touch-none shrink-0"
        aria-label="Reordenar"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors" />
      </button>

      {isEditing ? (
        <>
          <input
            type="color"
            value={editing!.color}
            onChange={(e) => setEditing((p) => p ? { ...p, color: e.target.value } : p)}
            className="h-7 w-7 cursor-pointer rounded border border-border bg-card p-0.5 shrink-0"
          />
          <Input
            value={editing!.name}
            onChange={(e) => setEditing((p) => p ? { ...p, name: e.target.value } : p)}
            className="h-7 text-sm flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit();
              if (e.key === "Escape") setEditing(null);
            }}
          />
          <Button size="icon" variant="ghost"
            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0"
            onClick={onSaveEdit}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
            onClick={() => setEditing(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <>
          <span className="h-4 w-4 rounded-full shrink-0 border border-white/10" style={{ background: c.color }} />
          <span className="flex-1 text-sm font-medium">{c.name}</span>
          <div className="flex items-center gap-3">
            <Label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <Switch
                checked={c.is_completed}
                onCheckedChange={(v) => onToggleCompleted(c.id, v)}
                className="scale-75"
              />
              Completado
            </Label>
            <Button variant="ghost" size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setEditing({ id: c.id, name: c.name, color: c.color })}
              aria-label="Editar columna"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(c.id)}
              aria-label="Eliminar columna"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
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
    <div className="space-y-4">
      {/* Add */}
      <Card className="p-4 border-border/50">
        <h3 className="text-sm font-semibold mb-3">Nueva columna</h3>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nombre de la columna"
            className="h-9 text-sm"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-md border border-border bg-card p-0.5 shrink-0"
            title="Color"
          />
          <Button onClick={add} className="h-9 gap-1.5 shrink-0">
            <Plus className="h-3.5 w-3.5" /> Añadir
          </Button>
        </div>
      </Card>

      {/* List */}
      <Card className="border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Columnas actuales</h3>
          <span className="text-xs text-muted-foreground">{cols.length} columnas</span>
        </div>

        <div className="divide-y divide-border/50">
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
            </div>
          ))}

          {!loading && cols.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
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
        </div>

        {!loading && cols.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/50 bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Arrastra las filas para reordenar · El switch <strong>Completado</strong> marca columnas que cierran solicitudes en analítica
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── AI settings ───────────────────────────────────────────────────────────────

const PRESET_MODELS = [
  { value: "gpt-4o-mini",  label: "GPT-4o Mini"  },
  { value: "gpt-4o",       label: "GPT-4o"        },
  { value: "gpt-4-turbo",  label: "GPT-4 Turbo"  },
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

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Model & parameters ── */}
      <Card className="p-5 border-border/50 space-y-5">
        <h3 className="text-sm font-semibold">Modelo y parámetros</h3>

        {/* Model selector */}
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Modelo
          </Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_MODELS.map((m) => (
              <button
                key={m.value}
                onClick={() => setModel(m.value)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border transition-colors",
                  model === m.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Modelo personalizado, ej: o3-mini"
            className="h-8 text-xs"
          />
        </div>

        {/* Temperature + Max tokens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Temperature */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Temperatura
              <span className="font-mono text-foreground text-sm">{temperature.toFixed(1)}</span>
            </Label>
            <Slider
              value={[temperature]}
              onValueChange={([v]) => setTemp(v)}
              min={0}
              max={2}
              step={0.1}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground select-none">
              <span>0 — Preciso</span>
              <span>1 — Balanceado</span>
              <span>2 — Creativo</span>
            </div>
          </div>

          {/* Max tokens */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tokens máximos
            </Label>
            <Input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              min={1}
              max={128000}
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Longitud máxima de la respuesta. GPT-4o soporta hasta 128 000.
            </p>
          </div>
        </div>
      </Card>

      {/* ── System prompt ── */}
      <Card className="p-5 border-border/50 space-y-3">
        <h3 className="text-sm font-semibold">Prompt del sistema</h3>
        <Textarea
          rows={10}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Eres un agente de intake de proyectos. Tu objetivo es..."
          className="text-sm resize-none font-mono"
        />
      </Card>

      {/* ── Intake questions ── */}
      <Card className="p-5 border-border/50 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Preguntas guía</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Una por línea. El agente las usa para estructurar la conversación de intake.
          </p>
        </div>
        <Textarea
          rows={6}
          value={questions}
          onChange={(e) => setQuestions(e.target.value)}
          placeholder={"¿Cuál es el objetivo principal del proyecto?\n¿Quiénes son los usuarios finales?\n¿Cuál es el plazo estimado?"}
          className="text-sm resize-none font-mono"
        />
      </Card>

      {/* ── Save ── */}
      <div className="flex items-center justify-between py-1">
        <p className="text-xs text-muted-foreground">
          Requiere <code className="font-mono">OPENAI_API_KEY</code> configurada en el servidor.
        </p>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving
            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            : <Save className="h-3.5 w-3.5" />
          }
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}

// ── Profile settings ─────────────────────────────────────────────────────────────

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
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const changePwdMutation = useMutation({
    mutationFn: changeOwnPassword,
    onSuccess: () => {
      toast.success("Contraseña actualizada correctamente");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    },
    onError: (error: any) => {
      toast.error(error.message ?? "Error al cambiar contraseña");
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }
    if (newPwd.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    changePwdMutation.mutate({ currentPassword: currentPwd, newPassword: newPwd });
  };

  const handleAreaChange = (areaId: string | null) => {
    updateAreaMutation.mutate({ areaId });
  };

  const areas = areasData?.areas || [];
  const currentAreaId = profile?.area_id || null;

  return (
    <div className="space-y-6">
      <Card className="p-5 border-border/50">
        <h3 className="text-sm font-semibold mb-4">Mi Área</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="area-select">Área asignada</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Selecciona el área organizacional a la que perteneces. Esto determinará qué solicitudes y datos puedes ver.
            </p>
            <Select
              value={currentAreaId || "none"}
              onValueChange={(value) => handleAreaChange(value === "none" ? null : value)}
              disabled={areasLoading || updateAreaMutation.isPending}
            >
              <SelectTrigger id="area-select">
                <SelectValue placeholder="Selecciona un área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin área</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentAreaId && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                Área actual: <span className="font-medium text-foreground">
                  {areas.find((a) => a.id === currentAreaId)?.name || "Desconocida"}
                </span>
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5 border-border/50">
        <h3 className="text-sm font-semibold mb-4">Información del Perfil</h3>
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <p className="text-sm text-muted-foreground mt-1">{profile?.full_name || "No especificado"}</p>
          </div>
          <div>
            <Label>Email</Label>
            <p className="text-sm text-muted-foreground mt-1">{profile?.email || "No especificado"}</p>
          </div>
        </div>
      </Card>

      <Card className="p-5 border-border/50">
        <h3 className="text-sm font-semibold mb-4">Cambiar Contraseña</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-pwd">Contraseña actual</Label>
            <Input
              id="current-pwd"
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pwd">Nueva contraseña</Label>
            <Input
              id="new-pwd"
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pwd">Confirmar nueva contraseña</Label>
            <Input
              id="confirm-pwd"
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={changePwdMutation.isPending} className="gap-2">
            {changePwdMutation.isPending
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              : <Lock className="h-3.5 w-3.5" />
            }
            Cambiar contraseña
          </Button>
        </form>
      </Card>
    </div>
  );
}
