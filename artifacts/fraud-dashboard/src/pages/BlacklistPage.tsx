import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBlocklist,
  useCreateBlocklistEntry,
  useUpdateBlocklistEntry,
  useDeleteBlocklistEntry,
  getListBlocklistQueryKey,
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { Shield, ShieldCheck, ShieldOff, Plus, Trash2, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight } from "lucide-react";

const ENTITY_TYPES = [
  { value: "", label: "All types" },
  { value: "merchant_id", label: "Merchant ID" },
  { value: "bin", label: "Card BIN" },
  { value: "ip", label: "IP Address" },
  { value: "email", label: "Email" },
  { value: "device_id", label: "Device ID" },
];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  merchant_id: "Merchant ID",
  bin: "Card BIN",
  ip: "IP Address",
  email: "Email",
  device_id: "Device ID",
};

const PAGE_SIZE = 20;

export default function BlacklistPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    entityType: "ip" as "merchant_id" | "bin" | "ip" | "email" | "device_id",
    entityValue: "",
    action: "block" as "block" | "allow",
    reason: "",
  });

  const params: Record<string, unknown> = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
  if (typeFilter) params.entityType = typeFilter;
  if (actionFilter) params.action = actionFilter;

  const { data, isLoading } = useListBlocklist(params as never, {
    query: { queryKey: getListBlocklistQueryKey(params as never) },
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListBlocklistQueryKey() });
  }

  const createMutation = useCreateBlocklistEntry({
    mutation: {
      onSuccess: () => { toast.success("Entry added"); setShowForm(false); setForm({ entityType: "ip", entityValue: "", action: "block", reason: "" }); invalidate(); },
      onError: () => toast.error("Failed to add entry"),
    },
  });

  const updateMutation = useUpdateBlocklistEntry({
    mutation: {
      onSuccess: () => { toast.success("Updated"); invalidate(); },
      onError: () => toast.error("Failed to update"),
    },
  });

  const deleteMutation = useDeleteBlocklistEntry({
    mutation: {
      onSuccess: () => { toast.success("Deleted"); invalidate(); },
      onError: () => toast.error("Failed to delete"),
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.entityValue.trim()) { toast.error("Value is required"); return; }
    createMutation.mutate({ data: { ...form, reason: form.reason || undefined } });
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Blocklist Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Block or allow merchants, IPs, card BINs, emails, and device IDs
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Add entry
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">New blocklist entry</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Entity type</label>
              <select
                value={form.entityType}
                onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value as typeof form.entityType }))}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ENTITY_TYPES.slice(1).map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Value</label>
              <input
                type="text"
                value={form.entityValue}
                onChange={(e) => setForm((f) => ({ ...f, entityValue: e.target.value }))}
                placeholder={form.entityType === "ip" ? "192.168.1.1" : form.entityType === "bin" ? "411111" : "value"}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Action</label>
              <div className="flex gap-2">
                {(["block", "allow"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, action: a }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition ${
                      form.action === a
                        ? a === "block"
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-green-500/10 border-green-500/30 text-green-400"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {a === "block" ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {a === "block" ? "Block" : "Allow"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Reason <span className="text-muted-foreground/60">(optional)</span></label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Fraud investigation, known bad actor…"
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {createMutation.isPending ? "Adding…" : "Add entry"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters + stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
          className="bg-card border border-border text-sm text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
        >
          {ENTITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          className="bg-card border border-border text-sm text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
        >
          <option value="">All actions</option>
          <option value="block">Blocked</option>
          <option value="allow">Allowed</option>
        </select>
        {(typeFilter || actionFilter) && (
          <button onClick={() => { setTypeFilter(""); setActionFilter(""); setPage(0); }} className="text-xs text-muted-foreground hover:text-foreground transition">
            Clear filters
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{total} entries</span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Type</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Value</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Action</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Reason</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Hits</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Status</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Added</th>
              <th className="px-3 py-3 text-xs text-muted-foreground font-medium" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">Loading…</td></tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <Shield className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No entries yet. Add your first blocklist entry above.</p>
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${!entry.active ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3">
                    <span className="text-xs font-medium text-foreground bg-muted px-2 py-0.5 rounded">
                      {ENTITY_TYPE_LABELS[entry.entityType] ?? entry.entityType}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-foreground max-w-36 truncate">{entry.entityValue}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${
                      entry.action === "block"
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-green-500/10 text-green-400 border-green-500/20"
                    }`}>
                      {entry.action === "block" ? <ShieldOff className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                      {entry.action === "block" ? "Blocked" : "Allowed"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground max-w-40 truncate">{entry.reason ?? "—"}</td>
                  <td className="px-3 py-3 text-xs font-mono text-foreground">{entry.hitCount}</td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => updateMutation.mutate({ id: entry.id, data: { active: !entry.active } })}
                      className={`text-xs font-medium transition ${entry.active ? "text-green-400 hover:text-green-300" : "text-muted-foreground hover:text-foreground"}`}
                      title={entry.active ? "Click to disable" : "Click to enable"}
                    >
                      {entry.active ? (
                        <span className="flex items-center gap-1"><ToggleRight className="w-4 h-4" /> Active</span>
                      ) : (
                        <span className="flex items-center gap-1"><ToggleLeft className="w-4 h-4" /> Inactive</span>
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => { if (confirm(`Delete this ${entry.entityType} entry?`)) deleteMutation.mutate({ id: entry.id }); }}
                      className="text-muted-foreground hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
