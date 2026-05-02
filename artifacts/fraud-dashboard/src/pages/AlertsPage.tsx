import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAlerts,
  useResolveAlert,
  getListAlertsQueryKey,
  getGetAnalyticsSummaryQueryKey,
} from "@workspace/api-client-react";
import { CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const PAGE_SIZE = 15;

export default function AlertsPage() {
  const [page, setPage] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [resolvedFilter, setResolvedFilter] = useState<string>("");
  const queryClient = useQueryClient();

  const params: Record<string, unknown> = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };
  if (severityFilter) params.severity = severityFilter;
  if (resolvedFilter !== "") params.resolved = resolvedFilter === "true";

  const data = useListAlerts(params as any, {
    query: { queryKey: getListAlertsQueryKey(params as any) },
  });

  const resolveAlert = useResolveAlert({
    mutation: {
      onSuccess: () => {
        toast.success("Alert resolved");
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAnalyticsSummaryQueryKey() });
      },
      onError: () => {
        toast.error("Failed to resolve alert");
      },
    },
  });

  const alerts = data?.alerts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Fraud Alerts</h1>
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} total alerts</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          data-testid="select-severity"
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setPage(0); }}
          className="bg-card border border-border text-sm text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          data-testid="select-resolved"
          value={resolvedFilter}
          onChange={(e) => { setResolvedFilter(e.target.value); setPage(0); }}
          className="bg-card border border-border text-sm text-foreground rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
        >
          <option value="">All alerts</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>
        {(severityFilter || resolvedFilter !== "") && (
          <button
            data-testid="button-clear-alert-filters"
            onClick={() => { setSeverityFilter(""); setResolvedFilter(""); setPage(0); }}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Alerts List */}
      <div className="space-y-2">
        {alerts.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
            No alerts found
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              data-testid={`card-alert-${alert.id}`}
              className={`bg-card border border-border rounded-xl p-4 ${alert.resolved ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEVERITY_COLORS[alert.severity] ?? ""}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Alert #{alert.id} · Tx #{alert.transactionId}
                    </span>
                    {alert.resolved && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Resolved
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mb-1">{alert.reason}</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      User: {alert.userName ?? `#${alert.userId}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Fraud score: {Math.round(alert.fraudScore * 100)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {alert.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">Note: {alert.notes}</p>
                  )}
                </div>
                {!alert.resolved && (
                  <button
                    data-testid={`button-resolve-${alert.id}`}
                    onClick={() => resolveAlert.mutate({ id: alert.id, data: {} })}
                    disabled={resolveAlert.isPending}
                    className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition disabled:opacity-50"
                  >
                    {resolveAlert.isPending ? "Resolving..." : "Resolve"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              data-testid="button-prev-alerts"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              data-testid="button-next-alerts"
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
