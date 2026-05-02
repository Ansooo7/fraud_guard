import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./logger";
import { verifyToken } from "./jwt";

let wss: WebSocketServer | null = null;

// userId → set of connected sockets
const userSockets = new Map<number, Set<WebSocket>>();

function registerSocket(userId: number, ws: WebSocket) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(ws);
}

function unregisterSocket(userId: number, ws: WebSocket) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) userSockets.delete(userId);
}

export function sendToUser(userId: number, payload: object): void {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const msg = JSON.stringify(payload);
  sockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

export function initWebSocketServer(server: import("http").Server): void {
  wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (ws) => {
    logger.info("WebSocket client connected");
    let authedUserId: number | null = null;

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "auth" && msg.token) {
          const payload = verifyToken(msg.token);
          authedUserId = payload.userId;
          registerSocket(authedUserId, ws);
          ws.send(JSON.stringify({ type: "auth_ok", userId: authedUserId }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });

    ws.on("close", () => {
      if (authedUserId !== null) unregisterSocket(authedUserId, ws);
      logger.info("WebSocket client disconnected");
    });

    ws.send(JSON.stringify({ type: "connected", message: "Fraud Detection System connected" }));
  });

  logger.info("WebSocket server initialized at /api/ws");
}

export function broadcastAlert(alert: object): void {
  if (!wss) return;
  const payload = JSON.stringify({ type: "fraud_alert", data: alert });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

export function broadcastTransaction(transaction: object): void {
  if (!wss) return;
  const payload = JSON.stringify({ type: "new_transaction", data: transaction });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}
