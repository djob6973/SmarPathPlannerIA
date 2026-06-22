import { useEffect, useState, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, MessageCircle, Clock, Send, Loader2, Calendar, Edit2, Check, Copy, Trash2, GitBranch, Link2, PackageCheck, Plus, CheckCircle2, Circle, Eye, EyeOff } from "lucide-react";
import { sendSlackNotification } from "@/lib/slack.functions";
import { useAuth } from "@/lib/auth-context";
import { getAreas } from "@/lib/data.functions";
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
import {
  getRequestDetails,
  getRequestsData,
  updateRequest as updateRequestFn,
  deleteRequest as deleteRequestFn,
  copyRequest as copyRequestFn,
  addComment as addCommentFn,
  updateComment as updateCommentFn,
  deleteComment as deleteCommentFn,
  addDeliverable as addDeliverableFn,
  updateDeliverable as updateDeliverableFn,
  toggleDeliverable as toggleDeliverableFn,
  deleteDeliverable as deleteDeliverableFn,
  type RequestRow,
  type ColumnRow,
  type CommentRow,
  type ProfileRow,
  type DeliverableRow,
} from "@/lib/requests.functions";

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
  const { user, isSuperAdmin } = useAuth();
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [columns, setColumns] = useState<ColumnRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [availableUsers, setAvailableUsers] = useState<{ id: string; full_name: string | null }[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canManageExpiration, setCanManageExpiration] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [updatingExpiration, setUpdatingExpiration] = useState(false);
  const [completedAt, setCompletedAt] = useState("");
  const [updatingCompletedAt, setUpdatingCompletedAt] = useState(false);
  const [canEditCreatedAt, setCanEditCreatedAt] = useState(false);
  const [createdAt, setCreatedAt] = useState("");
  const [updatingCreatedAt, setUpdatingCreatedAt] = useState(false);
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
  const [parent, setParent] = useState<RequestRow | null>(null);
  const [children, setChildren] = useState<RequestRow[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([]);
  const [newDeliverableTitle, setNewDeliverableTitle] = useState("");
  const [newDeliverableNotes, setNewDeliverableNotes] = useState("");
  const [showAddDeliverable, setShowAddDeliverable] = useState(false);
  const [addingDeliverable, setAddingDeliverable] = useState(false);
  const [togglingDeliverableId, setTogglingDeliverableId] = useState<string | null>(null);
  const [editingDeliverableId, setEditingDeliverableId] = useState<string | null>(null);
  const [editingDeliverableTitle, setEditingDeliverableTitle] = useState("");
  const [editingDeliverableNotes, setEditingDeliverableNotes] = useState("");
  const [savingDeliverableEdit, setSavingDeliverableEdit] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [canAssignRequest, setCanAssignRequest] = useState(false);
  const [canChangeStatus, setCanChangeStatus] = useState(false);
  const [sendingSlack, setSendingSlack] = useState(false);

  const toggleNotes = (id: string) => setExpandedNotes((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [isLinkingParent, setIsLinkingParent] = useState(false);
  const [linkableRequests, setLinkableRequests] = useState<RequestRow[]>([]);
  const [loadingLinkable, setLoadingLinkable] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [updatingParent, setUpdatingParent] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      getAreas().then(({ areas: a }) => setAreas(a));
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!requestId) return;
    setLoading(true);
    getRequestDetails({ data: { requestId } }).then(({ request: req, columns: cols, comments: comms, profiles: prof, availableUsers: users, parent: p, children: ch, deliverables: del }) => {
      setRequest(req);
      setColumns(cols);
      setComments(comms);
      setProfiles(prof);
      setAvailableUsers(users);
      setParent(p);
      setChildren(ch);
      setDeliverables(del);
      setIsLinkingParent(false);
      setSelectedParentId("");
      setShowAddDeliverable(false);
      setNewDeliverableTitle("");
      setNewDeliverableNotes("");
      setLoading(false);
    }).catch((err) => {
      toast.error("Error al cargar la solicitud: " + err?.message);
      setLoading(false);
    });
  }, [requestId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  useEffect(() => {
    if (!user) return;
    checkUserPermission({ data: { permission: "manage_request_expiration" } })
      .then(({ hasPermission }) => setCanManageExpiration(hasPermission))
      .catch(() => setCanManageExpiration(false));
  }, [user]);

  useEffect(() => {
    if (!user || !request) return;
    const isOwner = request.created_by === user.id;
    checkUserPermission({ data: { permission: "edit_all_requests" } }).then(({ hasPermission }) => {
      if (hasPermission) { setCanEditRequest(true); return; }
      checkUserPermission({ data: { permission: "edit_own_requests" } })
        .then(({ hasPermission: own }) => setCanEditRequest(own && isOwner))
        .catch(() => setCanEditRequest(false));
    }).catch(() => setCanEditRequest(false));
  }, [user, request]);

  useEffect(() => {
    if (!user) return;
    checkUserPermission({ data: { permission: "create_requests" } })
      .then(({ hasPermission }) => setCanCopyRequest(hasPermission))
      .catch(() => setCanCopyRequest(false));
  }, [user]);

  useEffect(() => {
    if (!user || !request) return;
    const isOwner = request.created_by === user.id;
    checkUserPermission({ data: { permission: "delete_all_requests" } }).then(({ hasPermission }) => {
      if (hasPermission) { setCanDeleteRequest(true); return; }
      checkUserPermission({ data: { permission: "delete_own_requests" } })
        .then(({ hasPermission: own }) => setCanDeleteRequest(own && isOwner))
        .catch(() => setCanDeleteRequest(false));
    }).catch(() => setCanDeleteRequest(false));
  }, [user, request]);

  useEffect(() => {
    if (request?.expires_at) {
      const date = new Date(request.expires_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      setExpiresAt(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`);
    } else {
      setExpiresAt("");
    }
  }, [request]);

  useEffect(() => {
    if (request?.completed_at) {
      const date = new Date(request.completed_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      setCompletedAt(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`);
    } else {
      setCompletedAt("");
    }
  }, [request]);

  useEffect(() => {
    if (request?.created_at) {
      const date = new Date(request.created_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      setCreatedAt(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`);
    }
  }, [request]);

  useEffect(() => {
    if (!user) return;
    checkUserPermission({ data: { permission: "edit_all_requests" } })
      .then(({ hasPermission }) => setCanEditCreatedAt(hasPermission))
      .catch(() => setCanEditCreatedAt(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    checkUserPermission({ data: { permission: "assign_requests" } })
      .then(({ hasPermission }) => setCanAssignRequest(hasPermission))
      .catch(() => setCanAssignRequest(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    checkUserPermission({ data: { permission: "change_request_status" } })
      .then(({ hasPermission }) => setCanChangeStatus(hasPermission))
      .catch(() => setCanChangeStatus(false));
  }, [user]);

  const loadLinkableRequests = async () => {
    if (!request) return;
    setIsLinkingParent(true);
    setLoadingLinkable(true);
    try {
      const { requests: all } = await getRequestsData({ data: {} });
      setLinkableRequests(all.filter((r) => r.id !== request.id && !r.parent_request_id));
    } catch {}
    setLoadingLinkable(false);
  };

  const linkParent = async () => {
    if (!request || !selectedParentId) return;
    setUpdatingParent(true);
    try {
      await updateRequestFn({ data: { requestId: request.id, parent_request_id: selectedParentId } });
      const found = linkableRequests.find((r) => r.id === selectedParentId) ?? null;
      setParent(found);
      setRequest((r) => r ? { ...r, parent_request_id: selectedParentId } : r);
      setIsLinkingParent(false);
      setSelectedParentId("");
      onUpdated?.();
      toast.success("Solicitud vinculada a la iniciativa");
    } catch (err: any) { toast.error(err?.message); }
    setUpdatingParent(false);
  };

  const unlinkParent = async () => {
    if (!request) return;
    setUpdatingParent(true);
    try {
      await updateRequestFn({ data: { requestId: request.id, parent_request_id: null } });
      setParent(null);
      setRequest((r) => r ? { ...r, parent_request_id: null } : r);
      onUpdated?.();
      toast.success("Iniciativa desvinculada");
    } catch (err: any) { toast.error(err?.message); }
    setUpdatingParent(false);
  };

  const updateCreatedAt = async (value: string) => {
    if (!request || !value) return;
    setUpdatingCreatedAt(true);
    try {
      await updateRequestFn({ data: { requestId: request.id, created_at: value } });
      setRequest((r) => r ? { ...r, created_at: new Date(value).toISOString() } : r);
      onUpdated?.();
      toast.success("Fecha de creación actualizada");
    } catch (err: any) {
      toast.error(err?.message);
      const date = new Date(request.created_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      setCreatedAt(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`);
    }
    setUpdatingCreatedAt(false);
  };

  const updateStatus = async (colId: string) => {
    if (!request) return;
    try {
      await updateRequestFn({ data: { requestId: request.id, status_column_id: colId } });
      setRequest((r) => r ? { ...r, status_column_id: colId } : r);
      onUpdated?.();
    } catch (err: any) { toast.error(err?.message); }
  };

  const updateAssignedTo = async (userId: string) => {
    if (!request) return;
    const value = userId === "unassigned" ? null : userId;
    try {
      await updateRequestFn({ data: { requestId: request.id, assigned_to: value } });
      setRequest((r) => r ? { ...r, assigned_to: value } : r);
      onUpdated?.();
    } catch (err: any) { toast.error(err?.message); }
  };

  const updateArea = async (areaId: string) => {
    if (!request) return;
    const value = areaId === "none" ? null : areaId;
    try {
      await updateRequestFn({ data: { requestId: request.id, area_id: value } });
      setRequest((r) => r ? { ...r, area_id: value } : r);
      onUpdated?.();
      toast.success("Área actualizada");
    } catch (err: any) { toast.error(err?.message); }
  };

  const updateExpiresAt = async (value: string) => {
    if (!request) return;
    setUpdatingExpiration(true);
    const expiresValue = value || null;
    try {
      await updateRequestFn({ data: { requestId: request.id, expires_at: expiresValue } });
      setRequest((r) => r ? { ...r, expires_at: expiresValue } : r);
      setExpiresAt(value);
      onUpdated?.();
      toast.success("Fecha de vencimiento actualizada");
    } catch (err: any) {
      toast.error(err?.message);
      setExpiresAt(request.expires_at ?? "");
    }
    setUpdatingExpiration(false);
  };

  const updateCompletedAt = async (value: string) => {
    if (!request) return;
    setUpdatingCompletedAt(true);
    const completedValue = value || null;
    try {
      await updateRequestFn({ data: { requestId: request.id, completed_at: completedValue } });
      setRequest((r) => r ? { ...r, completed_at: completedValue } : r);
      setCompletedAt(value);
      onUpdated?.();
      toast.success("Fecha de completado actualizada");
    } catch (err: any) {
      toast.error(err?.message);
      setCompletedAt(request.completed_at ?? "");
    }
    setUpdatingCompletedAt(false);
  };

  const startEditingRequest = () => {
    if (!request) return;
    setEditTitle(request.title);
    setEditDescription(request.description ?? "");
    setEditObjective(request.objective ?? "");
    setEditProcess(request.process ?? "");
    setEditPriority(request.priority);
    setEditStatusColumnId(request.status_column_id);
    setEditAssignedTo(request.assigned_to);
    setIsEditingRequest(true);
  };

  const cancelEditingRequest = () => {
    setIsEditingRequest(false);
    setEditTitle(""); setEditDescription(""); setEditObjective("");
    setEditProcess(""); setEditPriority(""); setEditStatusColumnId(null); setEditAssignedTo(null);
  };

  const saveRequestEdits = async () => {
    if (!request || !editTitle.trim()) { toast.error("El título es obligatorio"); return; }
    setUpdatingRequest(true);
    try {
      await updateRequestFn({ data: {
        requestId: request.id,
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        objective: editObjective.trim() || null,
        process: editProcess.trim() || null,
        priority: editPriority as any,
        status_column_id: editStatusColumnId,
        assigned_to: editAssignedTo,
      }});
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
    } catch (err: any) { toast.error(err?.message); }
    setUpdatingRequest(false);
  };

  const removeRequest = async () => {
    if (!request) return;
    if (!confirm("¿Eliminar esta solicitud? Esta acción no se puede deshacer.")) return;
    try {
      await deleteRequestFn({ data: { requestId: request.id } });
      toast.success("Solicitud eliminada");
      onUpdated?.();
      onClose();
    } catch (err: any) { toast.error(err?.message); }
  };

  const doCopyRequest = async () => {
    if (!request) return;
    setCopyingRequest(true);
    try {
      await copyRequestFn({ data: { requestId: request.id } });
      toast.success("Solicitud copiada exitosamente");
      onUpdated?.();
      onClose();
    } catch (err: any) { toast.error(err?.message); }
    setCopyingRequest(false);
  };

  const startEditingDeliverable = (item: DeliverableRow) => {
    setEditingDeliverableId(item.id);
    setEditingDeliverableTitle(item.title);
    setEditingDeliverableNotes(item.notes ?? "");
  };

  const cancelEditingDeliverable = () => {
    setEditingDeliverableId(null);
    setEditingDeliverableTitle("");
    setEditingDeliverableNotes("");
  };

  const saveDeliverableEdit = async () => {
    if (!editingDeliverableId || !editingDeliverableTitle.trim()) return;
    setSavingDeliverableEdit(true);
    try {
      await updateDeliverableFn({ data: { deliverableId: editingDeliverableId, title: editingDeliverableTitle.trim(), notes: editingDeliverableNotes.trim() || null } });
      setDeliverables((d) => d.map((item) => item.id === editingDeliverableId ? { ...item, title: editingDeliverableTitle.trim(), notes: editingDeliverableNotes.trim() || null } : item));
      toast.success("Entregable actualizado");
      cancelEditingDeliverable();
    } catch (err: any) { toast.error(err?.message); }
    setSavingDeliverableEdit(false);
  };

  const submitDeliverable = async () => {
    if (!newDeliverableTitle.trim() || !requestId) return;
    setAddingDeliverable(true);
    try {
      const { deliverable } = await addDeliverableFn({ data: { requestId, title: newDeliverableTitle.trim(), notes: newDeliverableNotes.trim() || null } });
      setDeliverables((d) => [...d, deliverable]);
      setNewDeliverableTitle("");
      setNewDeliverableNotes("");
      setShowAddDeliverable(false);
    } catch (err: any) { toast.error(err?.message); }
    setAddingDeliverable(false);
  };

  const handleToggleDeliverable = async (deliverable: DeliverableRow) => {
    setTogglingDeliverableId(deliverable.id);
    try {
      const { delivered_at } = await toggleDeliverableFn({ data: { deliverableId: deliverable.id, delivered: !deliverable.delivered_at } });
      setDeliverables((d) => d.map((item) => item.id === deliverable.id ? { ...item, delivered_at } : item));
    } catch (err: any) { toast.error(err?.message); }
    setTogglingDeliverableId(null);
  };

  const handleDeleteDeliverable = async (deliverableId: string) => {
    if (!confirm("¿Eliminar este entregable?")) return;
    try {
      await deleteDeliverableFn({ data: { deliverableId } });
      setDeliverables((d) => d.filter((item) => item.id !== deliverableId));
    } catch (err: any) { toast.error(err?.message); }
  };

  const sendComment = async () => {
    if (!newComment.trim() || !requestId) return;
    setSending(true);
    try {
      const { comment } = await addCommentFn({ data: { requestId, content: newComment.trim() } });
      setComments((c) => [...c, comment]);
      setNewComment("");
    } catch (err: any) { toast.error(err?.message); }
    setSending(false);
  };

  const startEditingComment = (comment: CommentRow) => {
    setEditingCommentId(comment.id);
    setEditingCommentContent(comment.content);
  };

  const cancelEditingComment = () => { setEditingCommentId(null); setEditingCommentContent(""); };

  const removeComment = async (commentId: string) => {
    if (!confirm("¿Eliminar este comentario?")) return;
    try {
      await deleteCommentFn({ data: { commentId } });
      setComments((c) => c.filter((com) => com.id !== commentId));
    } catch (err: any) { toast.error(err?.message); }
  };

  const saveCommentEdit = async () => {
    if (!editingCommentId || !editingCommentContent.trim()) return;
    setUpdatingComment(true);
    try {
      await updateCommentFn({ data: { commentId: editingCommentId, content: editingCommentContent.trim() } });
      setComments((c) => c.map((com) => com.id === editingCommentId ? { ...com, content: editingCommentContent.trim() } : com));
      toast.success("Comentario actualizado");
      cancelEditingComment();
    } catch (err: any) { toast.error(err?.message); }
    setUpdatingComment(false);
  };

  const handleSlackNotify = async () => {
    if (!request) return;
    setSendingSlack(true);
    try {
      await sendSlackNotification({ data: { requestId: request.id } });
      toast.success("Notificación enviada a Slack");
    } catch (err: any) {
      toast.error(err?.message ?? "Error al notificar a Slack");
    }
    setSendingSlack(false);
  };

  if (!requestId) return null;

  const creatorProfile = request?.created_by ? profiles[request.created_by] : null;
  const creatorName = creatorProfile?.full_name ?? creatorProfile?.email ?? "Desconocido";
  const currentCol = columns.find((c) => c.id === request?.status_column_id);

  return (
    <DialogPrimitive.Root open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl flex flex-col rounded-xl border border-border bg-card shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{ maxHeight: "90vh" }}
        >
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-xl">

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
            {request && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSlackNotify}
                disabled={sendingSlack}
                className="gap-2"
                style={{ color: "#4A154B" }}
                title="Notificar a Slack"
              >
                {sendingSlack ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.521-10.123a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.123 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.123a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                  </svg>
                )}
                Slack
              </Button>
            )}
            {canCopyRequest && (
              <Button variant="ghost" size="sm" onClick={doCopyRequest} disabled={copyingRequest} className="gap-2">
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
          <div className="flex flex-1 flex-col overflow-hidden border-r border-border min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-6">
              {isEditingRequest ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Título</label>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Descripción</label>
                    <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="text-sm min-h-[80px]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Objetivo</label>
                    <Textarea value={editObjective} onChange={(e) => setEditObjective(e.target.value)} className="text-sm min-h-[60px]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Procesos/Pasos</label>
                    <Textarea value={editProcess} onChange={(e) => setEditProcess(e.target.value)} className="text-sm min-h-[60px]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Prioridad</label>
                    <Select value={editPriority} onValueChange={setEditPriority}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
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
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
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
                    <Select value={editAssignedTo || "unassigned"} onValueChange={(v) => setEditAssignedTo(v === "unassigned" ? null : v)}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Sin asignar</SelectItem>
                        {availableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.full_name ?? "Usuario"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={saveRequestEdits} disabled={updatingRequest} className="flex-1">
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

              {/* Related requests (children) */}
              {children.length > 0 && (() => {
                const completedCount = children.filter((c) => c.completed_at !== null).length;
                const percent = Math.round((completedCount / children.length) * 100);
                const statusBreakdown = columns
                  .map((col) => ({ ...col, count: children.filter((c) => c.status_column_id === col.id).length }))
                  .filter((c) => c.count > 0);
                return (
                  <div className="border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Solicitudes relacionadas ({children.length})</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{completedCount} de {children.length} completadas</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {statusBreakdown.map((s) => (
                        <span key={s.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                          {s.name} ({s.count})
                        </span>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {children.map((child) => {
                        const childCol = columns.find((c) => c.id === child.status_column_id);
                        return (
                          <div key={child.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/50 text-xs">
                            <span className="flex-1 font-medium truncate">{child.title}</span>
                            <Badge className={cn("text-[10px] px-1.5 py-0 shrink-0", PRIORITY_CLASS[child.priority])}>{child.priority}</Badge>
                            {childCol && (
                              <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: childCol.color }} />
                                {childCol.name}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Deliverables */}
              {(deliverables.length > 0 || canEditRequest) && (() => {
                const deliveredCount = deliverables.filter((d) => d.delivered_at !== null).length;
                const total = deliverables.length;
                const percent = total > 0 ? Math.round((deliveredCount / total) * 100) : 0;
                return (
                  <div className="border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PackageCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Entregables ({total})</span>
                      </div>
                      {canEditRequest && (
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setShowAddDeliverable((v) => !v)}>
                          <Plus className="h-3 w-3" />
                          Agregar
                        </Button>
                      )}
                    </div>

                    {total > 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{deliveredCount} de {total} entregados</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    )}

                    {showAddDeliverable && (
                      <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                        <Input
                          placeholder="Nombre del entregable..."
                          value={newDeliverableTitle}
                          onChange={(e) => setNewDeliverableTitle(e.target.value)}
                          className="text-sm h-8"
                          disabled={addingDeliverable}
                          onKeyDown={(e) => { if (e.key === "Enter") submitDeliverable(); }}
                        />
                        <Textarea
                          placeholder="Notas o enlace (opcional)..."
                          value={newDeliverableNotes}
                          onChange={(e) => {
                            setNewDeliverableNotes(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          className="text-sm min-h-[60px] resize-none overflow-hidden leading-relaxed"
                          disabled={addingDeliverable}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs flex-1" onClick={submitDeliverable} disabled={addingDeliverable || !newDeliverableTitle.trim()}>
                            {addingDeliverable ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                            Guardar
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowAddDeliverable(false); setNewDeliverableTitle(""); setNewDeliverableNotes(""); }}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}

                    {total === 0 && !showAddDeliverable && (
                      <p className="text-xs text-muted-foreground italic">Sin entregables registrados.</p>
                    )}

                    <div className="space-y-1.5">
                      {deliverables.map((item) => {
                        const isDelivered = item.delivered_at !== null;
                        const isToggling = togglingDeliverableId === item.id;
                        const isEditingThis = editingDeliverableId === item.id;
                        return (
                          <div key={item.id} className={cn("flex items-start gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors", isDelivered ? "bg-emerald-500/10" : "bg-muted/50")}>
                            <button
                              onClick={() => handleToggleDeliverable(item)}
                              disabled={!canEditRequest || isToggling || isEditingThis}
                              className="shrink-0 mt-0.5 text-muted-foreground hover:text-emerald-500 disabled:opacity-50 transition-colors"
                            >
                              {isToggling
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : isDelivered
                                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                  : <Circle className="h-4 w-4" />
                              }
                            </button>
                            <div className="flex-1 min-w-0">
                              {isEditingThis ? (
                                <div className="space-y-1.5">
                                  <Input
                                    value={editingDeliverableTitle}
                                    onChange={(e) => setEditingDeliverableTitle(e.target.value)}
                                    className="text-xs h-7"
                                    disabled={savingDeliverableEdit}
                                    autoFocus
                                  />
                                  <Textarea
                                    value={editingDeliverableNotes}
                                    onChange={(e) => {
                                      setEditingDeliverableNotes(e.target.value);
                                      e.target.style.height = "auto";
                                      e.target.style.height = `${e.target.scrollHeight}px`;
                                    }}
                                    placeholder="Notas o enlace (opcional)..."
                                    className="text-xs min-h-[60px] resize-none overflow-hidden leading-relaxed"
                                    disabled={savingDeliverableEdit}
                                    rows={2}
                                  />
                                  <div className="flex gap-1.5">
                                    <Button size="sm" className="h-6 text-[11px] flex-1" onClick={saveDeliverableEdit} disabled={savingDeliverableEdit || !editingDeliverableTitle.trim()}>
                                      {savingDeliverableEdit ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                                      Guardar
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={cancelEditingDeliverable} disabled={savingDeliverableEdit}>
                                      <X className="h-3 w-3 mr-1" />Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("font-medium leading-snug", isDelivered && "line-through text-muted-foreground")}>{item.title}</span>
                                    {item.notes && (
                                      <button
                                        onClick={() => toggleNotes(item.id)}
                                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                        title={expandedNotes.has(item.id) ? "Ocultar notas" : "Ver notas"}
                                      >
                                        {expandedNotes.has(item.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                      </button>
                                    )}
                                  </div>
                                  <div className={cn(
                                    "transition-all duration-300 ease-in-out",
                                    expandedNotes.has(item.id) ? "max-h-40 opacity-100 mt-1.5 overflow-y-auto" : "max-h-0 opacity-0 overflow-hidden"
                                  )}>
                                    <p className="text-muted-foreground whitespace-pre-wrap text-[11px] leading-relaxed pr-1">{item.notes}</p>
                                  </div>
                                  {isDelivered && item.delivered_at && (
                                    <p className="text-emerald-600 dark:text-emerald-400 mt-0.5">
                                      Entregado {formatDistanceToNow(new Date(item.delivered_at), { addSuffix: true, locale: es })}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                            {canEditRequest && !isEditingThis && (
                              <div className="shrink-0 flex items-center gap-0.5">
                                <button onClick={() => startEditingDeliverable(item)} className="text-muted-foreground hover:text-foreground transition-colors">
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button onClick={() => handleDeleteDeliverable(item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

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
                    const canEditComment = isAuthor || canEditRequest;
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
                              <div className="ml-auto flex items-center gap-0.5">
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => startEditingComment(c)}>
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => removeComment(c.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
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
                                <Button size="sm" onClick={saveCommentEdit} disabled={updatingComment || !editingCommentContent.trim()} className="h-7 text-xs">
                                  {updatingComment ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  Guardar
                                </Button>
                                <Button variant="ghost" size="sm" onClick={cancelEditingComment} disabled={updatingComment} className="h-7 text-xs">
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
              <Button size="icon" onClick={sendComment} disabled={sending || !newComment.trim()} className="shrink-0 h-9 w-9 self-end">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Sidebar: metadata */}
          <div className="w-56 shrink-0 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
            {request && (
              <>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Iniciativa</p>
                  {parent ? (
                    <div className="flex items-start gap-1.5">
                      <GitBranch className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-xs flex-1 leading-tight">{parent.title}</span>
                      {canEditRequest && (
                        <button onClick={unlinkParent} disabled={updatingParent} className="text-muted-foreground hover:text-destructive shrink-0" title="Desvincular">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ) : isLinkingParent ? (
                    <div className="space-y-1.5">
                      <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Seleccionar iniciativa..." /></SelectTrigger>
                        <SelectContent>
                          {loadingLinkable ? (
                            <div className="p-2 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                          ) : linkableRequests.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground">Sin iniciativas disponibles</div>
                          ) : (
                            linkableRequests.map((r) => (
                              <SelectItem key={r.id} value={r.id} className="text-xs">{r.title}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-xs flex-1" onClick={linkParent} disabled={!selectedParentId || updatingParent}>
                          {updatingParent ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                          Vincular
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setIsLinkingParent(false)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : canEditRequest ? (
                    <button onClick={loadLinkableRequests} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <Link2 className="h-3 w-3" />
                      Vincular a iniciativa
                    </button>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sin iniciativa</p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Asignado a</p>
                  {canAssignRequest ? (
                    <Select value={request.assigned_to ?? "unassigned"} onValueChange={updateAssignedTo}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" className="text-xs">Sin asignar</SelectItem>
                        {availableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id} className="text-xs">{u.full_name ?? "Usuario"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2">
                      {request.assigned_to ? (
                        <>
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]">
                              {(profiles[request.assigned_to]?.full_name ?? profiles[request.assigned_to]?.email ?? "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">
                            {profiles[request.assigned_to]?.full_name ?? profiles[request.assigned_to]?.email}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin asignar</span>
                      )}
                    </div>
                  )}
                </div>

                {(isSuperAdmin || request.area_id) && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Área</p>
                    {isSuperAdmin ? (
                      <Select value={request.area_id ?? "none"} onValueChange={updateArea}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin área" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">Sin área</SelectItem>
                          {areas.map((a) => (
                            <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {areas.find((a) => a.id === request.area_id)?.name ?? "—"}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Estado</p>
                  {canChangeStatus ? (
                    <Select value={request.status_column_id ?? ""} onValueChange={updateStatus}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin estado" /></SelectTrigger>
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
                      <AvatarFallback className="text-[10px]">{creatorName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{creatorName}</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Creado</p>
                  {canEditCreatedAt ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={createdAt}
                        onChange={(e) => setCreatedAt(e.target.value)}
                        onBlur={() => updateCreatedAt(createdAt)}
                        disabled={updatingCreatedAt}
                        className="h-8 w-full text-xs rounded border border-input bg-background px-2 py-1"
                      />
                      {updatingCreatedAt && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {new Date(request.created_at).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Completado</p>
                  {canEditCreatedAt ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={completedAt}
                        onChange={(e) => setCompletedAt(e.target.value)}
                        onBlur={() => updateCompletedAt(completedAt)}
                        disabled={updatingCompletedAt}
                        className="h-8 w-full text-xs rounded border border-input bg-background px-2 py-1"
                      />
                      {updatingCompletedAt && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {request.completed_at
                        ? new Date(request.completed_at).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })
                        : "—"}
                    </p>
                  )}
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
                          {new Date(request.expires_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
