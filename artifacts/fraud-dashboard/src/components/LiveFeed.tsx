import { ShieldCheck, ShieldAlert, ShieldX, Wifi, WifiOff, Loader2 } from "lucide-react";
import type { LiveTransaction, ConnectionStatus } from "@/hooks/useLiveTransactions";

const STATUS_CONFIG = {
  approved: {
    icon: ShieldCheck,
    text: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    dot: "bg-green-400",
  },
  flagged: {
    icon: ShieldAlert,
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-400",
  },
  blocked: {
    icon: ShieldX,
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    dot: "bg-red-400",
  },
};

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
        </span>
        LIVE
      </span>
    );
  }
  if (status === "connecting") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Connecting…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <WifiOff className="w-3 h-3" />
      Disconnected
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.6 ? "text-red-400" : score >= 0.35 ? "text-amber-400" : "text-green-400";
  return <span className={`font-mono text-xs font-bold ${color}`}>{pct}%</span>;
}

export function LiveFeed({
  transactions,
  status,
  counts,
}: {
  transactions: LiveTransaction[];
  status: ConnectionStatus;
  counts: { approved: number; flagged: number; blocked: number; total: number };
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Live Transaction Feed</h2>
        </div>
        <ConnectionBadge status={status} />
      </div>

      {/* Session counters */}
      {counts.total > 0 && (
        <div className="px-5 py-2 border-b border-border/50 flex gap-4">
          <span className="text-xs text-muted-foreground">
            Session: <span className="font-medium text-foreground">{counts.total}</span>
          </span>
          <span className="text-xs text-green-400">✓ {counts.approved} approved</span>
          <span className="text-xs text-amber-400">⚑ {counts.flagged} flagged</span>
          <span className="text-xs text-red-400">✕ {counts.blocked} blocked</span>
        </div>
      )}

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-border/40">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            {status === "connected" ? (
              <>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Waiting for incoming transactions…</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Connect to see live transactions</p>
            )}
          </div>
        ) : (
          transactions.map((tx) => {
            const cfg = STATUS_CONFIG[tx.status];
            return (
              <div
                key={tx.id}
                className={`px-4 py-2.5 flex items-center gap-3 transition-all duration-300 ${
                  tx.isNew ? "bg-primary/5 animate-pulse-once" : "hover:bg-muted/20"
                }`}
              >
                {/* Status dot */}
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />

                {/* Merchant info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground truncate">{tx.merchantName}</span>
                    {tx.isNew && (
                      <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium leading-none">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground/70 truncate">{tx.location}</div>
                </div>

                {/* Amount */}
                <span className="text-xs font-mono text-foreground flex-shrink-0">
                  ${tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>

                {/* Fraud score */}
                <ScorePill score={tx.fraudScore} />

                {/* Status badge */}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize flex-shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}
                >
                  {tx.status}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
