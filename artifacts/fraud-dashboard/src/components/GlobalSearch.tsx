import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, ArrowLeftRight, ShieldAlert, FolderOpen, X } from "lucide-react";
import { globalSearch } from "@workspace/api-client-react";

type ResultItem = {
  type: "transaction" | "alert" | "case";
  id: number;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  href: string;
  createdAt: string;
};

const BADGE_COLORS: Record<string, string> = {
  red: "bg-red-500/15 text-red-400 border-red-500/20",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  green: "bg-green-500/15 text-green-400 border-green-500/20",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  gray: "bg-muted text-muted-foreground border-border",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  transaction: <ArrowLeftRight className="w-3.5 h-3.5" />,
  alert: <ShieldAlert className="w-3.5 h-3.5" />,
  case: <FolderOpen className="w-3.5 h-3.5" />,
};

const TYPE_LABEL: Record<string, string> = {
  transaction: "Transaction",
  alert: "Alert",
  case: "Case",
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setLocation] = useLocation();

  // Cmd/Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem("fraud_token") ?? "";
      const data = await globalSearch({ q, limit: 12 });
      setResults((data as any).results ?? []);
      setActiveIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  function handleSelect(item: ResultItem) {
    setOpen(false);
    setQuery("");
    setResults([]);
    setLocation(item.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[activeIndex]) { handleSelect(results[activeIndex]!); }
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border rounded">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        {/* Search box */}
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : (
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search transactions, alerts, cases…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((item, idx) => (
                <li key={`${item.type}-${item.id}`}>
                  <button
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      idx === activeIndex ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                      {TYPE_ICON[item.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground font-medium truncate">{item.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${BADGE_COLORS[item.badgeColor ?? "gray"]}`}>
                          {item.badge}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{TYPE_LABEL[item.type]}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results for "{query}"
            </div>
          )}

          {query.length < 2 && (
            <div className="px-4 py-4 text-xs text-muted-foreground flex items-center justify-between">
              <span>Type at least 2 characters to search</span>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono">↑↓</kbd>
                <span>navigate</span>
                <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono">↵</kbd>
                <span>open</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
