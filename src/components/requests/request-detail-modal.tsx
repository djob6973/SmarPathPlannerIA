import { useEffect, useState, useRef } from "react";
import { X, MessageCircle, Clock, Send, Loader2, Calendar, Edit2, Check, Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { checkUserPermission } from "@/lib/permissions.functions";

type Request = {
  id: string; title: string; description: string | null; objective: string | null; process: string | null; priority: string;
  status_column_id: string | null; created_by: string; assigned_to: string | null;
  created_at: string; updated_at: string; expires_at: string | null | undefined;
};
type Column = { id: string; name: string; color: string };
type Comment = { id: string; content: string; user_id: string; created_at: string };
type Profile = { id: string; full_name: string | null; email: string };

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "priority-urgent", high: "priority-high",
  medium: "priority-medium", low: "priority-low",
};

interface RequestDetailModalProps {
  requestId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export function RequestDetailModal({ requestId, onClose, onUpdated }: RequestDetailModalProps) {
  const { user, hasRole } = useAuth();
  const [request, setRequest] = useState<Request | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canManageExpiration, setCanManageExpiration] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [updatingExpiration, setUpdatingExpiration] = useState(false);
  const [creatorName, setCreatorName] = useState<string>("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [updatingComment, setUpdatingComment] = useState(false);
  const [isEditingRequest, setIsEditingRequest] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editObjective, setEditObjective] = useState("");
  const [editProcess, setEditProcess] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editStatusColumnId, setEditStatusColumnId] = useState<string | null>(null);
  const [editAssignedTo, setEditAssignedTo] = useState<string | null>(null);
  const [updatingRequest, setUpdatingRequest] = useState(false);
  const [canEditRequest, setCanEditRequest] = useState(false);
  const [canCopyRequest, setCanCopyRequest] = useState(false);
  const [copyingRequest, setCopyingRequest] = useState(false);
  const [canDeleteRequest, setCanDeleteRequest] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const canEdit = hasRole("admin") || hasRole("manager") || hasRole("client");

  useEffect(() => {
    if (!requestId) return;
    setLoading(true);
    Promise.all([
      supabase.from("requests").select("*").eq("id", requestId).single(),
      supabase.from("kanban_columns").select("id, name, color").order("position"),
      supabase.from("comments").select("*").eq("request_id", requestId).order("created_at"),
    ]).then(([{ data: req, error: reqError }, { data: cols, error: colsError }, { data: comms, error: commsError }]) => {
      if (reqError) {
        toast.error("Error al cargar la solicitud: " + reqError.message);
        setLoading(false);
        return;
      }
      if (colsError) {
        toast.error("Error al cargar las columnas: " + colsError.message);
        setLoading(false);
        return;
      }
      if (commsError) {
        toast.error("Error al cargar los comentarios: " + commsError.message);
        setLoading(false);
        return;
      }
      setRequest(req as Request);
      setColumns((cols ?? []) as Column[]);
      const commentList = (comms ?? []) as Comment[];
      setComments(commentList);
      
      // Get creator name directly from profiles table
      if (req?.created_by) {
        supabase.from("profiles").select("full_name, email").eq("id", req.created_by).maybeSingle().then(({ data, error }) => {
          console.log("[RequestDetailModal] Creator profile response:", { data, error });
          if (error) {
            console.error("Error loading creator profile:", error);
            setCreatorName("Desconocido");
          } else if (data) {
            const name = data.full_name || data.email || "Desconocido";
            console.log("[RequestDetailModal] Setting creator name to:", name);
            setCreatorName(name);
          } else {
            console.log("[RequestDetailModal] No profile found for creator");
            setCreatorName("Desconocido");
          }
        });
      }
      
      // load profiles for comment authors
      const userIds = [...new Set(commentList.map((c) => c.user_id))];
      if (userIds.length > 0) {
        supabase.from("profiles").select("id, full_name, email").in("id", userIds).then(({ data: p, error: profilesError }) => {
          if (profilesError) {
            console.error("Error loading profiles:", profilesError);
          } else {
            const map: Record<string, Profile> = {};
            (p ?? []).forEach((pr) => { map[pr.id] = pr as Profile; });
            setProfiles(map);
          }
        });
      }
      // load available users for assignment
      supabase.from("profiles").select("id, full_name, email").then(({ data: users, error: usersError }) => {
        if (usersError) {
          console.error("Error loading available users:", usersError);
          setAvailableUsers([]);
        } else {
          setAvailableUsers((users ?? []) as Profile[]);
        }
      });
      setLoading(false);
    });
  }, [requestId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  useEffect(() => {
    if (!user) return;
    console.log("[RequestDetailModal] Checking permission for user:", user.id);
    checkUserPermission({ data: { permission: "manage_request_expiration" } }).then(({ hasPermission }) => {
      console.log("[RequestDetailModal] Permission check result:", hasPermission);
      setCanManageExpiration(hasPermission);
    }).catch((error) => {
      console.error("[RequestDetailModal] Permission check error:", error);
      setCanManageExpiration(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !request) return;
    // Check if user can edit this request
    const isOwner = request.created_by === user.id;
    checkUserPermission({ data: { permission: "edit_all_requests" } }).then(({ hasPermission }) => {
      if (hasPermission) {
        setCanEditRequest(true);
      } else {
        checkUserPermission({ data: { permission: "edit_own_requests" } }).then(({ hasPermission }) => {
          setCanEditRequest(hasPermission && isOwner);
        }).catch(() => setCanEditRequest(false));
      }
    }).catch(() => setCanEditRequest(false));
  }, [user, request]);

  useEffect(() => {
    if (!user) return;
    // Check if user can copy requests (same as create permission)
    checkUserPermission({ data: { permission: "create_requests" } }).then(({ hasPermission }) => {
      setCanCopyRequest(hasPermission);
    }).catch(() => setCanCopyRequest(false));
  }, [user]);

  useEffect(() => {
    if (!user || !request) return;
    const isOwner = request.created_by === user.id;
    checkUserPermission({ data: { permission: "delete_all_requests" } }).then(({ hasPermission }) => {
      if (hasPermission) {
        setCanDeleteRequest(true);
      } else {
        checkUserPermission({ data: { permission: "delete_own_requests" } }).then(({ hasPermission: canOwn }) => {
          setCanDeleteRequest(canOwn && isOwner);
        }).catch(() => setCanDeleteRequest(false));
      }
    }).catch(() => setCanDeleteRequest(false));
  }, [user, request]);

  useEffect(() => {
    if (request?.expires_at) {
      // Convert database datetime format to datetime-local format (YYYY-MM-DDTHH:mm)
      const date = new Date(request.expires_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const formatted = `${year}-${month}-${day}T${hours}:${minutes}`;
      setExpiresAt(formatted);
    } else {
      setExpiresAt("");
    }
  }, [request]);

  const updateStatus = async (colId: string) => {
    if (!request) return;
    const { error } = await supabase.from("requests").update({ status_column_id: colId }).eq("id", request.id);
    if (error) toast.error(error.message);
    else { setRequest((r) => r ? { ...r, status_column_id: colId } : r); onUpdated?.(); }
  };

  const updateAssignedTo = async (userId: string) => {
    if (!request) return;
    const value = userId === "unassigned" ? null : userId;
    const { error } = await supabase.from("requests").update({ assigned_to: value }).eq("id", request.id);
    if (error) toast.error(error.message);
    else { setRequest((r) => r ? { ...r, assigned_to: value } : r); onUpdated?.(); }
  };

  const updateExpiresAt = async (value: string) => {
    if (!request) return;
    setUpdatingExpiration(true);
    const expiresValue = value || null;
    console.log("[RequestDetailModal] Updating expires_at:", { value, expiresValue, requestId: request.id });
    const { error, data } = await supabase.from("requests").update({ expires_at: expiresValue }).eq("id", request.id).select().single();
    if (error) {
      console.error("[RequestDetailModal] Error updating expires_at:", error);
      toast.error(error.message);
      setExpiresAt(request.expires_at || "");
    } else {
      console.log("[RequestDetailModal] Successfully updated expires_at:", data);
      setRequest((r) => r ? { ...r, expires_at: expiresValue } : r);
      setExpiresAt(value);
      onUpdated?.();
      toast.success("Fecha de vencimiento actualizada");
    }
    setUpdatingExpiration(false);
  };

  const startEditingRequest = () => {
    if (!request) return;
    setEditTitle(request.title);
    setEditDescription(request.description || "");
    setEditObjective(request.objective || "");
    setEditProcess(request.process || "");
    setEditPriority(request.priority);
    setEditStatusColumnId(request.status_column_id);
    setEditAssignedTo(request.assigned_to);
    setIsEditingRequest(true);
  };

  const cancelEditingRequest = () => {
    setIsEditingRequest(false);
    setEditTitle("");
    setEditDescription("");
    setEditObjective("");
    setEditProcess("");
    setEditPriority("");
    setEditStatusColumnId(null);
    setEditAssignedTo(null);
  };

  const updateRequest = async () => {
    if (!request || !editTitle.trim()) {
      toast.error("El título es obligatorio");
      return;
    }

    setUpdatingRequest(true);
    const { error } = await supabase.from("requests").update({
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      objective: editObjective.trim() || null,
      process: editProcess.trim() || null,
      priority: editPriority as any,
      status_column_id: editStatusColumnId,
      assigned_to: editAssignedTo,
    }).eq("id", request.id);

    if (error) {
      toast.error(error.message);
    } else {
      setRequest((r) => r ? {
        ...r,
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        objective: editObjective.trim() || null,
        process: editProcess.trim() || null,
        priority: editPriority,
        status_column_id: editStatusColumnId,
        assigned_to: editAssignedTo,
      } : r);
      toast.success("Solicitud actualizada");
      cancelEditingRequest();
      onUpdated?.();
    }
    setUpdatingRequest(false);
  };

  const removeRequest = async () => {
    if (!request) return;
    if (!confirm("¿Eliminar esta solicitud? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("requests").delete().eq("id", request.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitud eliminada");
    onUpdated?.();
    onClose();
  };

  const copyRequest = async () => {
    if (!request || !user) return;

    setCopyingRequest(true);
    const { error } = await supabase.from("requests").insert({
      title: `${request.title} (Copia)`,
      description: request.description,
      objective: request.objective,
      process: request.process,
      priority: request.priority,
      status_column_id: request.status_column_id,
      assigned_to: null, // Reset assignment for copy
      created_by: user.id,
      expires_at: request.expires_at,
    }).select().single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Solicitud copiada exitosamente");
      onUpdated?.();
      onClose();
    }
    setCopyingRequest(false);
  };

  const sendComment = async () => {
    if (!newComment.trim() || !requestId || !user) return;
    setSending(true);
    const { error, data } = await supabase
      .from("comments")
      .insert({ request_id: requestId, user_id: user.id, content: newComment.trim() })
      .select()
      .single();
    if (error) toast.error(error.message);
    else {
      setComments((c) => [...c, data as Comment]);
      setNewComment("");
    }
    setSending(false);
  };

  const startEditingComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentContent(comment.content);
  };

  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditingCommentContent("");
  };

  const updateComment = async () => {
    if (!editingCommentId || !editingCommentContent.trim()) return;
    setUpdatingComment(true);
    const { error } = await supabase
      .from("comments")
      .update({ content: editingCommentContent.trim() })
      .eq("id", editingCommentId);
    if (error) {
      toast.error(error.message);
    } else {
      setComments((c) =>
        c.map((comment) =>
          comment.id === editingCommentId
            ? { ...comment, content: editingCommentContent.trim() }
            : comment
        )
      );
      toast.success("Comentario actualizado");
      cancelEditingComment();
    }
    setUpdatingComment(false);
  };

  if (!requestId) return null;

  const currentCol = columns.find((c) => c.id === request?.status_column_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start gap-4 border-b border-border px-6 py-4">
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-6 w-64 animate-pulse rounded bg-muted" />
            ) : (
              <h2 className="text-base font-semibold leading-tight">{request?.title}</h2>
            )}
            {request && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className={cn("text-xs px-2 py-0.5", PRIORITY_CLASS[request.priority])}>
                  {request.priority}
                </Badge>
                {currentCol && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: currentCol.color }} />
                    {currentCol.name}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: es })}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canCopyRequest && (
              <Button variant="ghost" size="sm" onClick={copyRequest} disabled={copyingRequest} className="gap-2">
                {copyingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                Copiar
              </Button>
            )}
            {canEditRequest && !isEditingRequest && (
              <Button variant="ghost" size="sm" onClick={startEditingRequest} className="gap-2">
                <Edit2 className="h-4 w-4" />
                Editar
              </Button>
            )}
            {canDeleteRequest && (
              <Button variant="ghost" size="sm" onClick={removeRequest} className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main content */}
          <div className="flex flex-1 flex-col overflow-hidden border-r border-border">
            {/* Description */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {isEditingRequest ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Título</label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Descripción</label>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="text-sm min-h-[80px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Objetivo</label>
                    <Textarea
                      value={editObjective}
                      onChange={(e) => setEditObjective(e.target.value)}
                      className="text-sm min-h-[60px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Procesos/Pasos</label>
                    <Textarea
                      value={editProcess}
                      onChange={(e) => setEditProcess(e.target.value)}
                      className="text-sm min-h-[60px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Prioridad</label>
                    <Select value={editPriority} onValueChange={setEditPriority}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baja</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Estado</label>
                    <Select value={editStatusColumnId || ""} onValueChange={setEditStatusColumnId}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col.id} value={col.id}>
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                              {col.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Asignar a</label>
                    <Select value={editAssignedTo || "unassigned"} onValueChange={(value) => setEditAssignedTo(value === "unassigned" ? null : value)}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Sin asignar</SelectItem>
                        {availableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name || u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={updateRequest} disabled={updatingRequest} className="flex-1">
                      {updatingRequest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                      Guardar
                    </Button>
                    <Button variant="outline" onClick={cancelEditingRequest} disabled={updatingRequest} className="flex-1">
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {request?.description && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Descripción</h3>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{request.description}</p>
                    </div>
                  )}

                  {request?.objective && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Objetivo</h3>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{request.objective}</p>
                    </div>
                  )}

                  {request?.process && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Procesos/Pasos</h3>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{request.process}</p>
                    </div>
                  )}

                  {!request?.description && !request?.objective && !request?.process && (
                    <p className="text-sm text-muted-foreground italic">Sin información detallada.</p>
                  )}
                </>
              )}

              {/* Comments */}
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Comentarios ({comments.length})</span>
                </div>
                {comments.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aún no hay comentarios.</p>
                )}
                <div className="space-y-3">
                  {comments.map((c) => {
                    const profile = profiles[c.user_id];
                    const initials = (profile?.full_name ?? profile?.email ?? "?").slice(0, 2).toUpperCase();
                    const isAuthor = c.user_id === user?.id;
                    const canEditComment = isAuthor || hasRole("admin") || hasRole("manager");
                    const isEditing = editingCommentId === c.id;
                    return (
                      <div key={c.id} className="flex gap-3">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">
                              {profile?.full_name ?? profile?.email ?? "Usuario"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es })}
                            </span>
                            {canEditComment && !isEditing && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 ml-auto"
                                onClick={() => startEditingComment(c)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingCommentContent}
                                onChange={(e) => setEditingCommentContent(e.target.value)}
                                className="min-h-[60px] text-sm"
                                disabled={updatingComment}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={updateComment}
                                  disabled={updatingComment || !editingCommentContent.trim()}
                                  className="h-7 text-xs"
                                >
                                  {updatingComment ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  Guardar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelEditingComment}
                                  disabled={updatingComment}
                                  className="h-7 text-xs"
                                >
                                  <X className="h-3 w-3" />
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div ref={commentsEndRef} />
              </div>
            </div>

            {/* Comment input */}
            <div className="border-t border-border px-4 py-3 flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); }}}
                placeholder="Escribe un comentario... (Enter para enviar)"
                className="min-h-[60px] resize-none text-sm"
                disabled={sending}
              />
              <Button
                size="icon"
                onClick={sendComment}
                disabled={sending || !newComment.trim()}
                className="shrink-0 h-9 w-9 self-end"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Sidebar: metadata */}
          <div className="w-56 shrink-0 overflow-y-auto px-4 py-4 space-y-5">
            {request && (
              <>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Asignado a</p>
                  {canEdit ? (
                    <Select value={request.assigned_to ?? "unassigned"} onValueChange={updateAssignedTo}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" className="text-xs">Sin asignar</SelectItem>
                        {availableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id} className="text-xs">
                            {u.full_name ?? u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2">
                      {request.assigned_to ? (
                        <>
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]">
                              {(availableUsers.find(u => u.id === request.assigned_to)?.full_name ?? availableUsers.find(u => u.id === request.assigned_to)?.email ?? "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">
                            {availableUsers.find(u => u.id === request.assigned_to)?.full_name ?? availableUsers.find(u => u.id === request.assigned_to)?.email}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin asignar</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Estado</p>
                  {canEdit ? (
                    <Select value={request.status_column_id ?? ""} onValueChange={updateStatus}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Sin estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm">{currentCol?.name ?? "Sin estado"}</span>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Prioridad</p>
                  <Badge className={cn("text-xs px-2 py-0.5 capitalize", PRIORITY_CLASS[request.priority])}>
                    {request.priority}
                  </Badge>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Creado por</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {creatorName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{creatorName}</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Creado</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(request.created_at).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Actualizado</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(request.updated_at), { addSuffix: true, locale: es })}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Fecha de vencimiento</p>
                  {canManageExpiration ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        onBlur={() => updateExpiresAt(expiresAt)}
                        disabled={updatingExpiration}
                        className="h-8 w-full text-xs rounded border border-input bg-background px-2 py-1"
                      />
                      {updatingExpiration && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {request.expires_at ? (
                        <span className="text-muted-foreground">
                          {new Date(request.expires_at).toLocaleDateString("es", { 
                            day: "numeric", 
                            month: "short", 
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">Sin vencimiento</span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
