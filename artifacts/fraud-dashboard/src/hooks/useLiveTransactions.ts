import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

export type LiveTransaction = {
  id: string;
  merchantName: string;
  merchantCategory: string;
  amount: number;
  location: string;
  fraudScore: number;
  anomalyScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "approved" | "flagged" | "blocked";
  reason: string;
  timestamp: number;
  isNew?: boolean;
};

export type LiveAlert = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
  merchantName: string;
  amount: number;
  timestamp: number;
  isNew?: boolean;
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

const MAX_ITEMS = 25;

export function useLiveTransactions() {
  const [transactions, setTransactions] = useState<LiveTransaction[]>([]);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [counts, setCounts] = useState({ approved: 0, flagged: 0, blocked: 0, total: 0 });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/api/ws`;

    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus("connected");
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus("disconnected");
      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 3000);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setStatus("error");
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data as string);

        if (msg.type === "new_transaction" && msg.data) {
          const tx = msg.data;
          const liveTx: LiveTransaction = {
            id: String(tx.id ?? Math.random()),
            merchantName: tx.merchantName ?? "Unknown",
            merchantCategory: tx.merchantCategory ?? "",
            amount: Number(tx.amount ?? 0),
            location: tx.location ?? "",
            fraudScore: Number(tx.fraudScore ?? 0),
            anomalyScore: Number(tx.anomalyScore ?? 0),
            riskLevel: tx.riskLevel ?? "low",
            status: tx.status ?? "approved",
            reason: tx.reason ?? "",
            timestamp: Date.now(),
            isNew: true,
          };

          setTransactions((prev) => [liveTx, ...prev].slice(0, MAX_ITEMS));
          setCounts((c) => ({
            ...c,
            total: c.total + 1,
            approved: c.approved + (liveTx.status === "approved" ? 1 : 0),
            flagged: c.flagged + (liveTx.status === "flagged" ? 1 : 0),
            blocked: c.blocked + (liveTx.status === "blocked" ? 1 : 0),
          }));

          // Clear isNew after animation
          setTimeout(() => {
            setTransactions((prev) =>
              prev.map((t) => (t.id === liveTx.id ? { ...t, isNew: false } : t))
            );
          }, 1500);

          if (liveTx.status === "blocked") {
            toast.error(`🚫 Blocked: ${liveTx.merchantName} — $${liveTx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
              description: liveTx.reason,
              duration: 5000,
            });
          } else if (liveTx.status === "flagged" && liveTx.riskLevel === "high") {
            toast.warning(`⚠️ Flagged: ${liveTx.merchantName} — $${liveTx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
              description: liveTx.reason,
              duration: 4000,
            });
          }
        }

        if (msg.type === "fraud_alert" && msg.data) {
          const a = msg.data;
          const liveAlert: LiveAlert = {
            id: String(a.id ?? Math.random()),
            severity: a.severity ?? "medium",
            reason: a.reason ?? "",
            merchantName: a.merchantName ?? "Unknown",
            amount: Number(a.amount ?? 0),
            timestamp: Date.now(),
            isNew: true,
          };
          setAlerts((prev) => [liveAlert, ...prev].slice(0, MAX_ITEMS));
          setTimeout(() => {
            setAlerts((prev) =>
              prev.map((al) => (al.id === liveAlert.id ? { ...al, isNew: false } : al))
            );
          }, 1500);
        }
      } catch {
        // ignore malformed messages
      }
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { transactions, alerts, status, counts };
}
