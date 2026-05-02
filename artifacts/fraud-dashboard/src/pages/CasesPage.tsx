import { useState, useRef, useEffect } from "react";
import {
  useListCases,
  useCreateCase,
  useUpdateCase,
  useDeleteCase,
  useListCaseNotes,
  useAddCaseNote,
  getListCasesQueryKey,
  getListCaseNotesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FolderOpen,
  Plus,
  ChevronRight,
  X,
  ArrowRight,
  Trash2,
  User,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Send,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

type CaseStatus = "open" | "under_review" | "resolved" | "dismissed";
type CasePriority = "low" | "medium" | "high" | "critical";

type FraudCase = {
  id: number;
  title: string;
  description?: string | null;
  status: CaseStatus;
  priority: CasePriority;
  alertId?: number | null;
  transactionRef?: string | null;
  merchantName?: string | null;
  amount?: number | null;
  location?: string | null;
  assignedTo?: number | null;
  assigneeName?: string | null;
  createdBy?: number | null;
  noteCount?: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
};

type CaseNote = {
  id: number;
  caseId: number;
  content: string;
  createdBy?: number | null;
  authorName?: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<CaseStatus, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  open: { label: "Open", icon: FolderOpen, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  under_review: { label: "Under Review", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  resolved: { label: "Resolved", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
  dismissed: { label: "Dismissed", icon: XCircle, color: "text-muted-foreground", bg: "bg-muted/40", border: "border-border" },
};

const PRIORITY_CONFIG: Record<CasePriority, { label: string; color: string; dot: string }> = {
  low: { label: "Low", color: "text-slate-400", dot: "bg-slate-400" },
  medium: { label: "Medium", color: "text-amber-400", dot: "bg-amber-400" },
  high: { label: "High", color: "text-orange-400", dot: "bg-orange-400" },
  critical: { label: "Critical", color: "text-red-400", dot: "bg-red-500" },
};

const STATUS_FLOW: Record<CaseStatus, CaseStatus | null> = {
  open: "under_review",
  under_review: "resolved",
  resolved: null,
  dismissed: null,
};

const STATUS_NEXT_LABEL: Record<CaseStatus, string> = {
  open: "Start Review",
  under_review: "Mark Resolved",
  resolved: "",
  dismissed: "",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <cfg.icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function PriorityDot({ priority }: { priority: CasePriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Create/Edit Modal ─────────────────────────────────────────────────────────
function CaseModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: Partial<FraudCase>;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState<CasePriority>(initial?.priority ?? "medium");
  const [merchantName, setMerchantName] = useState(initial?.merchantName ?? "");
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [location, setLocation] = useState(initial?.location ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error("Title is required"); return; }
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      merchantName: merchantName.trim() || undefined,
      amount: amount ? parseFloat(amount) : undefined,
      location: location.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{initial?.id ? "Edit Case" : "New Case"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Suspicious high-value crypto transfer" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Additional context about this case..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Priority</label>
            <div className="flex gap-2">
              {(["low", "medium", "high", "critical"] as CasePriority[]).map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                return (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                      priority === p ? `${cfg.color} bg-muted border-current` : "border-border text-muted-foreground hover:text-foreground"
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Merchant</label>
              <input value={merchantName} onChange={(e) => setMerchantName(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Coinbase" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Amount</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01"
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Mumbai, Maharashtra" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition disabled:opacity-50">
              {saving ? "Saving…" : initial?.id ? "Save Changes" : "Create Case"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Case Detail Drawer ────────────────────────────────────────────────────────
function CaseDrawer({
  caseItem,
  onClose,
  onStatusChange,
  onDismiss,
  onEdit,
}: {
  caseItem: FraudCase;
  onClose: () => void;
  onStatusChange: (id: number, status: CaseStatus) => void;
  onDismiss: (id: number) => void;
  onEdit: (c: FraudCase) => void;
}) {
  const queryClient = useQueryClient();
  const notesQueryKey = getListCaseNotesQueryKey(caseItem.id);

  const { data: notes = [] } = useListCaseNotes(caseItem.id, {
    query: { queryKey: notesQueryKey },
  });

  const addNoteMutation = useAddCaseNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: notesQueryKey });
        queryClient.invalidateQueries({ queryKey: getListCasesQueryKey() });
        setNoteText("");
      },
      onError: () => toast.error("Failed to add note"),
    },
  });

  const [noteText, setNoteText] = useState("");
  const notesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [(notes as CaseNote[]).length]);

  const nextStatus = STATUS_FLOW[caseItem.status];
  const isTerminal = caseItem.status === "resolved" || caseItem.status === "dismissed";

  function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    addNoteMutation.mutate({ id: caseItem.id, data: { content: noteText.trim() } });
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-xl bg-card border-l border-border flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusBadge status={caseItem.status} />
              <PriorityDot priority={caseItem.priority} />
              <span className="text-xs text-muted-foreground">#{caseItem.id}</span>
            </div>
            <h2 className="text-sm font-semibold text-foreground leading-snug">{caseItem.title}</h2>
            {caseItem.description && (
              <p className="text-xs text-muted-foreground mt-1">{caseItem.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onEdit(caseItem)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="px-5 py-3 border-b border-border grid grid-cols-2 gap-3">
          {caseItem.merchantName && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Merchant</p>
              <p className="text-xs font-medium text-foreground">{caseItem.merchantName}</p>
            </div>
          )}
          {caseItem.amount != null && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Amount</p>
              <p className="text-xs font-mono font-bold text-foreground">${caseItem.amount.toLocaleString()}</p>
            </div>
          )}
          {caseItem.location && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Location</p>
              <p className="text-xs text-foreground">{caseItem.location}</p>
            </div>
          )}
          {caseItem.assigneeName && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Assigned To</p>
              <p className="text-xs text-foreground flex items-center gap-1">
                <User className="w-3 h-3" />{caseItem.assigneeName}
              </p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Opened</p>
            <p className="text-xs text-foreground">{timeAgo(caseItem.createdAt)}</p>
          </div>
          {caseItem.resolvedAt && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Resolved</p>
              <p className="text-xs text-foreground">{timeAgo(caseItem.resolvedAt)}</p>
            </div>
          )}
        </div>

        {/* Status progression */}
        {!isTerminal && (
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 text-xs text-muted-foreground">
              {(["open", "under_review", "resolved"] as CaseStatus[]).map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
                  <span className={`font-medium ${caseItem.status === s ? STATUS_CONFIG[s].color : "text-muted-foreground/50"}`}>
                    {STATUS_CONFIG[s].label}
                  </span>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              {nextStatus && (
                <button
                  onClick={() => onStatusChange(caseItem.id, nextStatus)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition font-medium"
                >
                  <ArrowRight className="w-3 h-3" />
                  {STATUS_NEXT_LABEL[caseItem.status]}
                </button>
              )}
              <button
                onClick={() => onDismiss(caseItem.id)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Notes thread */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            Notes ({(notes as CaseNote[]).length})
          </p>
          {(notes as CaseNote[]).length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No notes yet. Add the first one below.
            </div>
          ) : (
            (notes as CaseNote[]).map((note) => (
              <div key={note.id} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3 h-3 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold text-foreground">{note.authorName ?? "Analyst"}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(note.createdAt)}</span>
                  </div>
                  <p className="text-xs text-foreground/90 bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">{note.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={notesEndRef} />
        </div>

        {/* Add note */}
        <form onSubmit={submitNote} className="px-5 py-4 border-t border-border">
          <div className="flex gap-2">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note…"
              className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={!noteText.trim() || addNoteMutation.isPending}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CasesPage() {
  const queryClient = useQueryClient();
  const casesQueryKey = getListCasesQueryKey();

  const [filterStatus, setFilterStatus] = useState<CaseStatus | "">("");
  const [filterPriority, setFilterPriority] = useState<CasePriority | "">("");
  const [search, setSearch] = useState("");
  const [selectedCase, setSelectedCase] = useState<FraudCase | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<FraudCase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FraudCase | null>(null);

  const queryParams: Record<string, unknown> = {};
  if (filterStatus) queryParams.status = filterStatus;
  if (filterPriority) queryParams.priority = filterPriority;

  const { data: cases = [], isLoading } = useListCases(
    filterStatus || filterPriority ? queryParams as any : undefined,
    { query: { queryKey: casesQueryKey } }
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: casesQueryKey });

  const createMutation = useCreateCase({
    mutation: {
      onSuccess: () => { invalidate(); setShowCreate(false); toast.success("Case created"); },
      onError: () => toast.error("Failed to create case"),
    },
  });

  const updateMutation = useUpdateCase({
    mutation: {
      onSuccess: (data) => {
        invalidate();
        setEditTarget(null);
        if (selectedCase?.id === (data as FraudCase).id) setSelectedCase(data as FraudCase);
        toast.success("Case updated");
      },
      onError: () => toast.error("Failed to update case"),
    },
  });

  const deleteMutation = useDeleteCase({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeleteTarget(null);
        if (selectedCase?.id === deleteTarget?.id) setSelectedCase(null);
        toast.success("Case deleted");
      },
      onError: () => toast.error("Failed to delete case"),
    },
  });

  function handleStatusChange(id: number, status: CaseStatus) {
    updateMutation.mutate({ id, data: { status } });
  }

  function handleDismiss(id: number) {
    updateMutation.mutate({ id, data: { status: "dismissed" } });
  }

  const typed = cases as FraudCase[];
  const filtered = typed.filter((c) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) &&
        !(c.merchantName ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Summary counts
  const counts = { open: 0, under_review: 0, resolved: 0, dismissed: 0 };
  typed.forEach((c) => { counts[c.status]++; });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Case Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage fraud investigations from alert to resolution.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Case
        </button>
      </div>

      {/* Status summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {(["open", "under_review", "resolved", "dismissed"] as CaseStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const active = filterStatus === s;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(active ? "" : s)}
              className={`rounded-xl border p-4 text-left transition ${
                active ? `${cfg.bg} ${cfg.border}` : "bg-card border-border hover:border-border/60"
              }`}
            >
              <div className={`text-2xl font-bold mb-0.5 ${cfg.color}`}>{counts[s]}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <cfg.icon className="w-3 h-3" />
                {cfg.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cases…"
            className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as CasePriority | "")}
            className="bg-card border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="">All priorities</option>
            {(["critical", "high", "medium", "low"] as CasePriority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cases list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-14 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <FolderOpen className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No cases found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search || filterStatus || filterPriority
                ? "Try clearing the filters"
                : "Create your first fraud investigation case"}
            </p>
          </div>
          {!search && !filterStatus && !filterPriority && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" />
              Create First Case
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const cfg = STATUS_CONFIG[c.status];
            const pcfg = PRIORITY_CONFIG[c.priority];
            const isSelected = selectedCase?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedCase(isSelected ? null : c)}
                className={`bg-card border rounded-xl px-5 py-4 cursor-pointer transition hover:border-border/60 group ${
                  isSelected ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Priority indicator */}
                  <div className={`w-1 h-10 rounded-full flex-shrink-0 ${pcfg.dot}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">{c.title}</span>
                      <span className="text-xs text-muted-foreground/60">#{c.id}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <StatusBadge status={c.status} />
                      <PriorityDot priority={c.priority} />
                      {c.merchantName && (
                        <span className="text-xs text-muted-foreground">{c.merchantName}</span>
                      )}
                      {c.amount != null && (
                        <span className="text-xs font-mono text-foreground">${c.amount.toLocaleString()}</span>
                      )}
                      {c.location && (
                        <span className="text-xs text-muted-foreground truncate">{c.location}</span>
                      )}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {(c.noteCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="w-3 h-3" />
                        {c.noteCount}
                      </span>
                    )}
                    {c.assigneeName && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        {c.assigneeName}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditTarget(c); }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                        className="p-1 rounded text-muted-foreground hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition ${isSelected ? "rotate-90" : ""}`} />
                  </div>
                </div>

                {/* Inline quick-action */}
                {isSelected && STATUS_FLOW[c.status] && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-muted-foreground flex-1">Quick actions</span>
                    <button
                      onClick={() => handleStatusChange(c.id, STATUS_FLOW[c.status]!)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition flex items-center gap-1"
                    >
                      <ArrowRight className="w-3 h-3" />
                      {STATUS_NEXT_LABEL[c.status]}
                    </button>
                    <button
                      onClick={() => { setSelectedCase(c); }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition"
                    >
                      Open Details
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CaseModal
          onSave={(data) => createMutation.mutate({ data: data as any })}
          onClose={() => setShowCreate(false)}
          saving={createMutation.isPending}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <CaseModal
          initial={editTarget}
          onSave={(data) => updateMutation.mutate({ id: editTarget.id, data: data as any })}
          onClose={() => setEditTarget(null)}
          saving={updateMutation.isPending}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-sm font-semibold text-foreground mb-2">Delete Case</h2>
            <p className="text-xs text-muted-foreground mb-5">
              Delete <span className="font-semibold text-foreground">"{deleteTarget.title}"</span>? All notes will be permanently removed.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({ id: deleteTarget.id })}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case detail drawer */}
      {selectedCase && (
        <CaseDrawer
          caseItem={selectedCase}
          onClose={() => setSelectedCase(null)}
          onStatusChange={(id, status) => {
            handleStatusChange(id, status);
            setSelectedCase(null);
          }}
          onDismiss={(id) => {
            handleDismiss(id);
            setSelectedCase(null);
          }}
          onEdit={(c) => { setEditTarget(c); setSelectedCase(null); }}
        />
      )}
    </div>
  );
}
