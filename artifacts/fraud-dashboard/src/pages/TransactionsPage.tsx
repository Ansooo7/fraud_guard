import { useState } from "react";
import {
  useListTransactions,
  getListTransactionsQueryKey,
} from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, Trash2 } from "lucide-react";
import { useFilterPresets } from "@/hooks/useFilterPresets";

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-500/10 text-green-400 border-green-500/20",
  flagged: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  blocked: "bg-red-500/10 text-red-400 border-red-500/20",
};

const RISK_COLORS: Record<string, string> = {
  low: "text-green-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

function FraudScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.6 ? "bg-red-500" : score >= 0.35 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

const PAGE_SIZE = 20;

export default function TransactionsPage() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [presetName, setPresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const { presets, savePreset, deletePreset } = useFilterPresets("transactions");

  const params: Record<string, unknown> = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };
  if (statusFilter) params.status = statusFilter;
  if (riskFilter) params.riskLevel = riskFilter;

  const { data, isLoading } = useListTransactions(params as never, {
    query: { queryKey: getListTransactionsQueryKey(params as never) },
  });

  const transactions = data?.transactions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const hasFilters = !!(statusFilter || riskFilter);

  function applyPreset(preset: { filters: Record<string, string> }) {
    setStatusFilter(preset.filters.status ?? "");
    setRiskFilter(preset.filters.riskLevel ?? "");
    setPage(0);
  }

  function handleSavePreset(e: React.FormEvent) {
    e.preventDefault();
    if (!presetName.trim()) return;
    savePreset(presetName.trim(), { status: statusFilter, riskLevel: riskFilter });
    setPresetName("");
    setShowSaveInput(false);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total transactions</p>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          data-testid="select-status"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="bg-card border border-border text-sm text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
        >
          <option value="">All statuses</option>
          <option value="approved">Approved</option>
          <option value="flagged">Flagged</option>
          <option value="blocked">Blocked</option>
        </select>
        <select
          data-testid="select-risk"
          value={riskFilter}
          onChange={(e) => { setRiskFilter(e.target.value); setPage(0); }}
          className="bg-card border border-border text-sm text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
        >
          <option value="">All risk levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        {hasFilters && (
          <button
            data-testid="button-clear-filters"
            onClick={() => { setStatusFilter(""); setRiskFilter(""); setPage(0); }}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            Clear filters
          </button>
        )}

        {/* Save preset button */}
        {hasFilters && !showSaveInput && (
          <button
            onClick={() => setShowSaveInput(true)}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Save as preset
          </button>
        )}

        {showSaveInput && (
          <form onSubmit={handleSavePreset} className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name…"
              className="bg-card border border-border text-sm text-foreground rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button type="submit" className="text-xs text-primary hover:text-primary/80 font-medium transition">
              Save
            </button>
            <button type="button" onClick={() => setShowSaveInput(false)} className="text-xs text-muted-foreground hover:text-foreground transition">
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* Saved presets */}
      {presets.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <BookmarkCheck className="w-3 h-3" /> Saved presets:
          </span>
          {presets.map((p) => (
            <div key={p.id} className="flex items-center gap-0.5">
              <button
                onClick={() => applyPreset(p)}
                className="text-xs px-2.5 py-1 rounded-l-md bg-muted/60 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                {p.name}
              </button>
              <button
                onClick={() => deletePreset(p.id)}
                className="text-xs px-1.5 py-1 rounded-r-md bg-muted/60 border border-l-0 border-border text-muted-foreground/50 hover:text-red-400 transition"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">ID</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Merchant</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">User</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Amount</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Location</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Status</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Risk</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Fraud Score</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">Loading...</td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">No transactions found</td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr
                  key={tx.id}
                  data-testid={`row-transaction-${tx.id}`}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-5 py-3 text-xs font-mono text-muted-foreground">#{tx.id}</td>
                  <td className="px-3 py-3">
                    <div className="text-xs font-medium text-foreground">{tx.merchantName}</div>
                    {tx.merchantCategory && (
                      <div className="text-xs text-muted-foreground">{tx.merchantCategory}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{tx.userName ?? `User #${tx.userId}`}</td>
                  <td className="px-3 py-3 text-xs font-mono text-foreground">
                    ${Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground max-w-28 truncate">{tx.location}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[tx.status] ?? ""}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-medium ${RISK_COLORS[tx.riskLevel] ?? "text-muted-foreground"}`}>
                      {tx.riskLevel}
                    </span>
                  </td>
                  <td className="px-3 py-3 w-32">
                    <FraudScoreBar score={tx.fraudScore} />
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} ({total} results)
          </span>
          <div className="flex items-center gap-2">
            <button
              data-testid="button-prev-page"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              data-testid="button-next-page"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
