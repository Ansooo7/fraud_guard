import { useState } from "react";
import { useCheckFraud } from "@workspace/api-client-react";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Zap,
  AlertTriangle,
  Info,
} from "lucide-react";

const MERCHANT_CATEGORIES = [
  { value: "retail", label: "Retail" },
  { value: "food", label: "Food & Dining" },
  { value: "fuel", label: "Fuel / Gas" },
  { value: "entertainment", label: "Entertainment" },
  { value: "electronics", label: "Electronics" },
  { value: "jewelry", label: "Jewelry" },
  { value: "gift_cards", label: "Gift Cards" },
  { value: "gambling", label: "Gambling" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "wire_transfer", label: "Wire Transfer" },
  { value: "money_order", label: "Money Order" },
  { value: "travel", label: "Travel" },
  { value: "healthcare", label: "Healthcare" },
];

const LOCATIONS = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Miami, FL",
  "Houston, TX",
  "London, UK",
  "Tokyo, JP",
  "Paris, FR",
  "Toronto, CA",
  "Sydney, AU",
];

type FraudResult = {
  fraudScore: number;
  anomalyScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "approved" | "flagged" | "blocked";
  severity: string;
  reason: string;
  signals: string[];
};

const STATUS_CONFIG = {
  approved: {
    label: "Approved",
    icon: ShieldCheck,
    bg: "bg-green-500/10 border-green-500/20",
    text: "text-green-400",
    bar: "bg-green-500",
  },
  flagged: {
    label: "Flagged",
    icon: ShieldAlert,
    bg: "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-400",
    bar: "bg-amber-500",
  },
  blocked: {
    label: "Blocked",
    icon: ShieldX,
    bg: "bg-red-500/10 border-red-500/20",
    text: "text-red-400",
    bar: "bg-red-500",
  },
};

const RISK_COLORS = {
  low: "text-green-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

function GaugeBar({ score, label }: { score: number; label: string }) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.6 ? "bg-red-500" : score >= 0.35 ? "bg-amber-500" : "bg-green-500";
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-sm font-bold ${score >= 0.6 ? "text-red-400" : score >= 0.35 ? "text-amber-400" : "text-green-400"}`}>
          {pct}%
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function FraudCheckPage() {
  const [amount, setAmount] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantCategory, setMerchantCategory] = useState("");
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [result, setResult] = useState<FraudResult | null>(null);

  const checkMutation = useCheckFraud({
    mutation: {
      onSuccess: (data) => {
        setResult(data as FraudResult);
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const loc = location === "__custom__" ? customLocation : location;
    checkMutation.mutate({
      data: {
        amount: parseFloat(amount),
        merchantName,
        merchantCategory: merchantCategory || undefined,
        location: loc,
      },
    });
  }

  function handleReset() {
    setResult(null);
    setAmount("");
    setMerchantName("");
    setMerchantCategory("");
    setLocation("");
    setCustomLocation("");
    checkMutation.reset();
  }

  const statusCfg = result ? STATUS_CONFIG[result.status] : null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Fraud Check</h1>
        <p className="text-sm text-muted-foreground">
          Enter transaction details to get an instant fraud risk prediction from the scoring engine.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Form */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Transaction Details</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Amount (USD) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">$</span>
                <input
                  data-testid="input-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg pl-7 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition font-mono"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Merchant Name */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Merchant Name <span className="text-red-400">*</span>
              </label>
              <input
                data-testid="input-merchant-name"
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                placeholder="e.g. Amazon, Shell Gas"
                required
              />
            </div>

            {/* Merchant Category */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Merchant Category
              </label>
              <select
                data-testid="select-category"
                value={merchantCategory}
                onChange={(e) => setMerchantCategory(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition appearance-none cursor-pointer"
              >
                <option value="">Select category...</option>
                {MERCHANT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              {merchantCategory && ["gambling", "crypto", "wire_transfer", "money_order"].includes(merchantCategory) && (
                <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> High-risk category
                </p>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Location <span className="text-red-400">*</span>
              </label>
              <select
                data-testid="select-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition appearance-none cursor-pointer"
                required={location !== "__custom__"}
              >
                <option value="">Select location...</option>
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
                <option value="__custom__">Other (type manually)</option>
              </select>
              {location === "__custom__" && (
                <input
                  data-testid="input-custom-location"
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  className="mt-2 w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                  placeholder="City, Country"
                  required
                />
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                data-testid="button-check-fraud"
                type="submit"
                disabled={checkMutation.isPending}
                className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkMutation.isPending ? "Analyzing..." : "Analyze Transaction"}
              </button>
              {result && (
                <button
                  type="button"
                  onClick={handleReset}
                  data-testid="button-reset"
                  className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Result Panel */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-5">
            <Info className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Analysis Result</h2>
          </div>

          {!result && !checkMutation.isPending ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <ShieldAlert className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Fill in the transaction details and click "Analyze" to get a fraud risk prediction.
              </p>
            </div>
          ) : checkMutation.isPending ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Running fraud analysis...</p>
            </div>
          ) : result && statusCfg ? (
            <div className="flex-1 flex flex-col gap-5">
              {/* Verdict */}
              <div className={`rounded-xl border p-4 ${statusCfg.bg}`}>
                <div className="flex items-center gap-3">
                  <statusCfg.icon className={`w-8 h-8 ${statusCfg.text}`} />
                  <div>
                    <div className={`text-xl font-bold ${statusCfg.text}`}>{statusCfg.label}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      Risk level: <span className={`font-semibold ${RISK_COLORS[result.riskLevel]}`}>{result.riskLevel}</span>
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-xs text-muted-foreground">Amount</div>
                    <div className="text-sm font-mono font-bold text-foreground">
                      ${parseFloat(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scores */}
              <div className="space-y-3">
                <GaugeBar score={result.fraudScore} label="Fraud Score" />
                <GaugeBar score={result.anomalyScore} label="Anomaly Score" />
              </div>

              {/* Risk Signals */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Risk Signals</p>
                <div className="space-y-1.5">
                  {result.signals.map((signal, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg ${
                        signal.toLowerCase().includes("no risk")
                          ? "bg-green-500/10 text-green-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                      {signal}
                    </div>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div className="mt-auto pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground font-medium mb-1">Engine conclusion</p>
                <p className="text-xs text-foreground">{result.reason}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Quick test presets */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Quick test scenarios</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Normal purchase", amount: "45.99", merchant: "Starbucks", category: "food", location: "New York, NY" },
            { label: "High-value retail", amount: "8500", merchant: "Apple Store", category: "electronics", location: "Los Angeles, CA" },
            { label: "Crypto exchange", amount: "3200", merchant: "Coinbase", category: "crypto", location: "Miami, FL" },
            { label: "Casino charge", amount: "5000", merchant: "Bellagio Casino", category: "gambling", location: "Las Vegas, NV" },
            { label: "Wire transfer", amount: "15000", merchant: "Western Union", category: "wire_transfer", location: "London, UK" },
          ].map((preset) => (
            <button
              key={preset.label}
              data-testid={`preset-${preset.label.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => {
                setAmount(preset.amount);
                setMerchantName(preset.merchant);
                setMerchantCategory(preset.category);
                setLocation(preset.location);
                setResult(null);
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
