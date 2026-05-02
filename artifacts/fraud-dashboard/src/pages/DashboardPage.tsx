import {
  useGetAnalyticsSummary,
  useGetFraudTrend,
  useGetRiskDistribution,
  useListTransactions,
  useListAlerts,
  getGetAnalyticsSummaryQueryKey,
  getGetFraudTrendQueryKey,
  getGetRiskDistributionQueryKey,
  getListTransactionsQueryKey,
  getListAlertsQueryKey,
} from "@workspace/api-client-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, ShieldAlert, Ban, AlertCircle, Activity } from "lucide-react";

function StatCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-500/10 text-green-400 border-green-500/20",
  flagged: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  blocked: "bg-red-500/10 text-red-400 border-red-500/20",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400",
  high: "bg-orange-500/10 text-orange-400",
  medium: "bg-amber-500/10 text-amber-400",
  low: "bg-blue-500/10 text-blue-400",
};

function FraudScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.6 ? "bg-red-500" : score >= 0.35 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function DashboardPage() {
  const summary = useGetAnalyticsSummary({ query: { queryKey: getGetAnalyticsSummaryQueryKey() } });
  const trend = useGetFraudTrend({ query: { queryKey: getGetFraudTrendQueryKey() } });
  const distribution = useGetRiskDistribution({ query: { queryKey: getGetRiskDistributionQueryKey() } });
  const transactions = useListTransactions({ limit: 8, offset: 0 }, { query: { queryKey: getListTransactionsQueryKey({ limit: 8, offset: 0 }) } });
  const alerts = useListAlerts({ limit: 5, offset: 0, resolved: false }, { query: { queryKey: getListAlertsQueryKey({ limit: 5, offset: 0, resolved: false }) } });

  const s = summary;
  const fraudRate = s ? Math.round((s.fraudRate ?? 0) * 100) : 0;

  const trendData = trend?.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    total: d.totalTransactions,
    flagged: d.flaggedCount,
    blocked: d.blockedCount,
  })) ?? [];

  const distData = distribution?.map((d) => ({
    name: d.riskLevel.charAt(0).toUpperCase() + d.riskLevel.slice(1),
    value: d.count,
    color: RISK_COLORS[d.riskLevel] ?? "#6b7280",
  })) ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time fraud monitoring overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Transactions"
          value={s?.totalTransactions?.toLocaleString() ?? "—"}
          sub={`${s?.todayTransactions ?? 0} today`}
          color="bg-primary/10 text-primary"
          icon={Activity}
        />
        <StatCard
          label="Flagged"
          value={s?.flaggedTransactions?.toLocaleString() ?? "—"}
          color="bg-amber-500/10 text-amber-400"
          icon={ShieldAlert}
        />
        <StatCard
          label="Blocked"
          value={s?.blockedTransactions?.toLocaleString() ?? "—"}
          color="bg-red-500/10 text-red-400"
          icon={Ban}
        />
        <StatCard
          label="Open Alerts"
          value={s?.unresolvedAlerts?.toLocaleString() ?? "—"}
          sub={`${s?.todayAlerts ?? 0} today`}
          color="bg-orange-500/10 text-orange-400"
          icon={AlertCircle}
        />
        <StatCard
          label="Fraud Rate"
          value={`${fraudRate}%`}
          sub={`Avg score: ${((s?.averageFraudScore ?? 0) * 100).toFixed(1)}%`}
          color="bg-purple-500/10 text-purple-400"
          icon={TrendingUp}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Fraud Trend (30 Days)</h2>
          {trendData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="flaggedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="blockedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217.2 32.6% 17.5%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 20.2% 65.1%)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20.2% 65.1%)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(222 47% 11%)", border: "1px solid hsl(217.2 32.6% 17.5%)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(210 40% 98%)" }}
                />
                <Area type="monotone" dataKey="flagged" stroke="#f59e0b" fill="url(#flaggedGrad)" strokeWidth={2} name="Flagged" />
                <Area type="monotone" dataKey="blocked" stroke="#ef4444" fill="url(#blockedGrad)" strokeWidth={2} name="Blocked" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Distribution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Risk Distribution</h2>
          {distData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No data</div>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={distData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                    {distData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(222 47% 11%)", border: "1px solid hsl(217.2 32.6% 17.5%)", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-1 justify-center">
                {distData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions + Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Recent Transactions</h2>
          </div>
          {transactions?.transactions?.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No transactions yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-2.5 text-xs text-muted-foreground font-medium">Merchant</th>
                  <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-medium">Amount</th>
                  <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-medium">Status</th>
                  <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {transactions?.transactions?.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-transaction-${tx.id}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground text-xs">{tx.merchantName}</div>
                      <div className="text-xs text-muted-foreground">{tx.location}</div>
                    </td>
                    <td className="px-3 py-3 text-xs font-mono text-foreground">
                      ${Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[tx.status] ?? ""}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 w-28">
                      <FraudScoreBar score={tx.fraudScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Alerts */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Open Alerts</h2>
          </div>
          {alerts?.alerts?.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No open alerts</div>
          ) : (
            <div className="divide-y divide-border/50">
              {alerts?.alerts?.map((alert) => (
                <div key={alert.id} className="px-4 py-3" data-testid={`card-alert-${alert.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SEVERITY_COLORS[alert.severity] ?? ""}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-foreground line-clamp-2">{alert.reason}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.userName ?? "Unknown user"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
