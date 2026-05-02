import { useState, useRef, useCallback } from "react";
import { useBatchCheckFraud } from "@workspace/api-client-react";
import {
  Upload,
  Download,
  FileText,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Clipboard,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const TEMPLATE_CSV = `amount,merchantName,merchantCategory,location,deviceId
45.99,Starbucks,food,"New York, NY",device-001
8500.00,Apple Store,electronics,"Los Angeles, CA",device-002
3200.00,Coinbase,crypto,"Miami, FL",device-003
5000.00,Bellagio Casino,gambling,"Las Vegas, NV",device-004
15000.00,Western Union,wire_transfer,"London, UK",device-005
23.50,McDonald's,food,"Chicago, IL",device-001
1200.00,Best Buy,electronics,"Houston, TX",device-006
75.00,Shell,fuel,"Dallas, TX",device-001
`;

type ResultItem = {
  index: number;
  merchantName: string;
  merchantCategory: string;
  amount: number;
  location: string;
  fraudScore: number;
  anomalyScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "approved" | "flagged" | "blocked";
  severity: string;
  reason: string;
  signals: string[];
};

type BatchResult = {
  total: number;
  approved: number;
  flagged: number;
  blocked: number;
  results: ResultItem[];
};

type ParsedRow = {
  amount: number;
  merchantName: string;
  merchantCategory?: string;
  location: string;
  deviceId?: string;
};

const STATUS_STYLE = {
  approved: { icon: ShieldCheck, text: "text-green-400", bg: "bg-green-500/10" },
  flagged: { icon: ShieldAlert, text: "text-amber-400", bg: "bg-amber-500/10" },
  blocked: { icon: ShieldX, text: "text-red-400", bg: "bg-red-500/10" },
};

const RISK_COLOR = {
  low: "text-green-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8">{Math.round(value * 100)}%</span>
    </div>
  );
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

  const headers = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
  const required = ["amount", "merchantname", "location"];
  for (const r of required) {
    if (!headers.includes(r)) throw new Error(`Missing required column: ${r}`);
  }

  const idx = (name: string) => headers.indexOf(name);

  return lines.slice(1).map((line, i) => {
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map((c) => c.replace(/^"|"$/g, "").trim()) ?? line.split(",");
    const amount = parseFloat(cols[idx("amount")]);
    if (isNaN(amount) || amount <= 0) throw new Error(`Row ${i + 2}: invalid amount`);
    const merchantName = cols[idx("merchantname")];
    if (!merchantName) throw new Error(`Row ${i + 2}: missing merchantName`);
    const location = cols[idx("location")];
    if (!location) throw new Error(`Row ${i + 2}: missing location`);
    return {
      amount,
      merchantName,
      merchantCategory: idx("merchantcategory") >= 0 ? cols[idx("merchantcategory")] || undefined : undefined,
      location,
      deviceId: idx("deviceid") >= 0 ? cols[idx("deviceid")] || undefined : undefined,
    };
  });
}

function downloadCSV(results: ResultItem[]) {
  const headers = ["#", "Merchant", "Category", "Amount", "Location", "Fraud Score", "Anomaly Score", "Risk Level", "Status", "Signals"];
  const rows = results.map((r) => [
    r.index + 1,
    `"${r.merchantName}"`,
    r.merchantCategory || "",
    r.amount.toFixed(2),
    `"${r.location}"`,
    Math.round(r.fraudScore * 100),
    Math.round(r.anomalyScore * 100),
    r.riskLevel,
    r.status,
    `"${r.signals.join("; ")}"`,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fraud-batch-results-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BatchFraudCheckPage() {
  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "approved" | "flagged" | "blocked">("all");
  const [sortBy, setSortBy] = useState<"index" | "fraudScore" | "amount">("fraudScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const batchMutation = useBatchCheckFraud({
    mutation: {
      onSuccess: (data) => setResult(data as BatchResult),
      onError: () => toast.error("Batch analysis failed. Please try again."),
    },
  });

  function handleTextChange(text: string) {
    setCsvText(text);
    setParseError(null);
    setParsed(null);
    setResult(null);
    if (!text.trim()) return;
    try {
      const rows = parseCSV(text);
      setParsed(rows);
    } catch (e: any) {
      setParseError(e.message);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Please upload a .csv file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => handleTextChange(ev.target?.result as string);
    reader.readAsText(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleTextChange(ev.target?.result as string);
    reader.readAsText(file);
  }, []);

  function handleAnalyze() {
    if (!parsed || parsed.length === 0) return;
    batchMutation.mutate({ data: { transactions: parsed } });
  }

  function handleReset() {
    setCsvText("");
    setParsed(null);
    setParseError(null);
    setResult(null);
    batchMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fraud-batch-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  }

  const filteredResults = result
    ? result.results
        .filter((r) => filter === "all" || r.status === filter)
        .sort((a, b) => {
          const v = sortDir === "asc" ? 1 : -1;
          if (sortBy === "fraudScore") return (a.fraudScore - b.fraudScore) * v;
          if (sortBy === "amount") return (a.amount - b.amount) * v;
          return (a.index - b.index) * v;
        })
    : [];

  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy === col ? (
      sortDir === "desc" ? <ChevronDown className="w-3 h-3 inline ml-0.5" /> : <ChevronUp className="w-3 h-3 inline ml-0.5" />
    ) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Batch Fraud Check</h1>
          <p className="text-sm text-muted-foreground">Upload or paste a CSV of transactions to get fraud scores for all of them at once (up to 500 rows).</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition"
          >
            <Download className="w-3.5 h-3.5" />
            Template CSV
          </button>
          {(csvText || result) && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {!result ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Upload area */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Upload or Paste CSV</h2>
            </div>

            {/* Drop zone */}
            <div
              data-testid="drop-zone"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition group"
            >
              <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition" />
              <p className="text-sm text-muted-foreground text-center">Drop a .csv file here or click to browse</p>
              <p className="text-xs text-muted-foreground/60">Accepts .csv files up to 500 rows</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFile}
                data-testid="file-input"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Paste area */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">Paste CSV content</label>
                <button
                  data-testid="paste-button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      handleTextChange(text);
                    } catch {
                      toast.error("Clipboard access denied — paste manually below");
                    }
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                >
                  <Clipboard className="w-3 h-3" />
                  Paste from clipboard
                </button>
              </div>
              <textarea
                data-testid="csv-textarea"
                value={csvText}
                onChange={(e) => handleTextChange(e.target.value)}
                rows={10}
                spellCheck={false}
                className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-xs text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition resize-none"
                placeholder={"amount,merchantName,merchantCategory,location\n45.99,Starbucks,food,\"New York, NY\"\n3200.00,Coinbase,crypto,\"Miami, FL\""}
              />
            </div>
          </div>

          {/* Preview panel */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Preview</h2>
              {parsed && <span className="ml-auto text-xs text-muted-foreground">{parsed.length} rows ready</span>}
            </div>

            {parseError ? (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-red-400">Parse error</p>
                  <p className="text-xs text-red-400/80 mt-0.5">{parseError}</p>
                </div>
              </div>
            ) : !parsed ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center gap-2">
                <FileText className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Upload or paste your CSV to preview transactions</p>
                <p className="text-xs text-muted-foreground/60">Required columns: amount, merchantName, location</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 p-2.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <p className="text-xs text-green-400">
                    <span className="font-semibold">{parsed.length}</span> transactions parsed — ready for analysis
                  </p>
                </div>
                <div className="overflow-auto rounded-lg border border-border flex-1 max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">#</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Merchant</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Amount</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((row, i) => (
                        <tr key={i} className="border-t border-border/50 hover:bg-muted/30 transition">
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2 text-foreground font-medium max-w-[120px] truncate">{row.merchantName}</td>
                          <td className="px-3 py-2 text-right font-mono text-foreground">${row.amount.toFixed(2)}</td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{row.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  data-testid="button-analyze"
                  onClick={handleAnalyze}
                  disabled={batchMutation.isPending}
                  className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {batchMutation.isPending
                    ? `Analyzing ${parsed.length} transactions...`
                    : `Analyze ${parsed.length} Transaction${parsed.length !== 1 ? "s" : ""}`}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Results view */
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total", value: result.total, color: "text-foreground", bg: "bg-card" },
              { label: "Approved", value: result.approved, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
              { label: "Flagged", value: result.flagged, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
              { label: "Blocked", value: result.blocked, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
            ].map((card) => (
              <div key={card.label} className={`rounded-xl border p-4 ${card.bg} border-border`}>
                <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
                {card.label !== "Total" && (
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    {Math.round((card.value / result.total) * 100)}% of total
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex gap-1.5">
              {(["all", "approved", "flagged", "blocked"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                  {f !== "all" && (
                    <span className="ml-1 opacity-60">
                      ({f === "approved" ? result.approved : f === "flagged" ? result.flagged : result.blocked})
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              data-testid="button-export"
              onClick={() => downloadCSV(result.results)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export results CSV
            </button>
          </div>

          {/* Results table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium w-8">
                    <button onClick={() => toggleSort("index")} className="hover:text-foreground transition">
                      # <SortIcon col="index" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Merchant</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">
                    <button onClick={() => toggleSort("amount")} className="hover:text-foreground transition">
                      Amount <SortIcon col="amount" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Location</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                    <button onClick={() => toggleSort("fraudScore")} className="hover:text-foreground transition">
                      Fraud Score <SortIcon col="fraudScore" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Anomaly</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((row) => {
                  const st = STATUS_STYLE[row.status];
                  const expanded = expandedRow === row.index;
                  const scoreColor =
                    row.fraudScore >= 0.6 ? "bg-red-500" : row.fraudScore >= 0.35 ? "bg-amber-500" : "bg-green-500";
                  return (
                    <>
                      <tr
                        key={row.index}
                        onClick={() => setExpandedRow(expanded ? null : row.index)}
                        className="border-t border-border/50 hover:bg-muted/20 cursor-pointer transition"
                      >
                        <td className="px-4 py-3 text-muted-foreground font-mono">{row.index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground truncate max-w-[120px]">{row.merchantName}</div>
                          {row.merchantCategory && (
                            <div className="text-muted-foreground/60 text-xs">{row.merchantCategory}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          ${row.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell truncate max-w-[120px]">
                          {row.location}
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBar value={row.fraudScore} color={scoreColor} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <ScoreBar
                            value={row.anomalyScore}
                            color={row.anomalyScore >= 0.6 ? "bg-red-500" : row.anomalyScore >= 0.35 ? "bg-amber-500" : "bg-green-500"}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium capitalize ${st.bg} ${st.text}`}>
                            <st.icon className="w-3 h-3" />
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </td>
                      </tr>
                      {expanded && (
                        <tr key={`${row.index}-expanded`} className="border-t border-border/30 bg-muted/20">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="flex flex-wrap gap-4 text-xs">
                              <div>
                                <p className="text-muted-foreground font-medium mb-1.5">Risk Signals</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {row.signals.map((s, i) => (
                                    <span
                                      key={i}
                                      className={`px-2 py-0.5 rounded-md ${
                                        s.toLowerCase().includes("no risk")
                                          ? "bg-green-500/10 text-green-400"
                                          : "bg-amber-500/10 text-amber-400"
                                      }`}
                                    >
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="border-l border-border pl-4">
                                <p className="text-muted-foreground font-medium mb-1.5">Risk Level</p>
                                <span className={`font-semibold capitalize ${RISK_COLOR[row.riskLevel]}`}>{row.riskLevel}</span>
                              </div>
                              <div className="border-l border-border pl-4 flex-1">
                                <p className="text-muted-foreground font-medium mb-1.5">Engine Conclusion</p>
                                <p className="text-foreground">{row.reason}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
            {filteredResults.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">No results match this filter</div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-right">
            Showing {filteredResults.length} of {result.total} transactions
          </p>
        </div>
      )}
    </div>
  );
}
