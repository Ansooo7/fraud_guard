import {
  useGetFraudTrend,
  useGetRiskDistribution,
  useGetTopRiskUsers,
  useGetAnalyticsSummary,
  getGetFraudTrendQueryKey,
  getGetRiskDistributionQueryKey,
  getGetTopRiskUsersQueryKey,
  getGetAnalyticsSummaryQueryKey,
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
  Legend,
} from "recharts";

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

function RiskScoreBar({ score }: { score: number }) {
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

export default function AnalyticsPage() {
  const trend = useGetFraudTrend({ query: { queryKey: getGetFraudTrendQueryKey() } });
  const distribution = useGetRiskDistribution({ query: { queryKey: getGetRiskDistributionQueryKey() } });
  const topUsers = useGetTopRiskUsers({ query: { queryKey: getGetTopRiskUsersQueryKey() } });
  const summary = useGetAnalyticsSummary({ query: { queryKey: getGetAnalyticsSummaryQueryKey() } });

  const trendData = trend?.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    total: d.totalTransactions,
    flagged: d.flaggedCount,
    blocked: d.blockedCount,
    rate: Math.round(d.fraudRate * 100),
  })) ?? [];

  const distData = distribution?.map((d) => ({
    name: d.riskLevel.charAt(0).toUpperCase() + d.riskLevel.slice(1),
    value: d.count,
    pct: d.percentage,
    color: RISK_COLORS[d.riskLevel] ?? "#6b7280",
  })) ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Deep-dive fraud intelligence</p>
      </div>

      {/* Summary row */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Volume", value: `$${Number(summary.totalAmountProcessed).toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
            { label: "Fraud Rate", value: `${Math.round(summary.fraudRate * 100)}%` },
            { label: "Avg Fraud Score", value: `${Math.round(summary.averageFraudScore * 100)}%` },
            { label: "Total Alerts", value: summary.totalAlerts.toLocaleString() },
          ].map((item) => (
            <div key={item.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{item.label}</p>
              <p className="text-2xl font-bold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Trend chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Fraud Trend — 30 Days</h2>
        {trendData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="flagGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="blockGrad2" x1="0" y1="0" x2="0" y2="1">
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
              <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#totalGrad)" strokeWidth={1.5} name="Total" />
              <Area type="monotone" dataKey="flagged" stroke="#f59e0b" fill="url(#flagGrad2)" strokeWidth={2} name="Flagged" />
              <Area type="monotone" dataKey="blocked" stroke="#ef4444" fill="url(#blockGrad2)" strokeWidth={2} name="Blocked" />
              <Legend iconType="line" wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "hsl(215 20.2% 65.1%)" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Risk Distribution */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Risk Distribution</h2>
          {distData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={distData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {distData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(222 47% 11%)", border: "1px solid hsl(217.2 32.6% 17.5%)", borderRadius: 8, fontSize: 12 }}
                    formatter={(value, name) => [`${value} (${distData.find(d => d.name === name)?.pct ?? 0}%)`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-1">
                {distData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                    {d.name}: {d.value} ({d.pct}%)
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top Risk Users */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Top Risk Users</h2>
          </div>
          {!topUsers || topUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No data</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-5 py-2.5 text-xs text-muted-foreground font-medium">User</th>
                  <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-medium">Transactions</th>
                  <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-medium">Flagged</th>
                  <th className="text-left px-3 py-2.5 text-xs text-muted-foreground font-medium">Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u) => (
                  <tr key={u.userId} className="border-b border-border/50 hover:bg-muted/20 transition-colors" data-testid={`row-user-${u.userId}`}>
                    <td className="px-5 py-3">
                      <div className="text-xs font-medium text-foreground">{u.userName}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{u.transactionCount}</td>
                    <td className="px-3 py-3 text-xs text-amber-400">{u.flaggedCount}</td>
                    <td className="px-3 py-3 w-36">
                      <RiskScoreBar score={u.riskScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
