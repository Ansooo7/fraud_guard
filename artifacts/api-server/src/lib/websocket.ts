import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./logger";

let wss: WebSocketServer | null = null;

export function initWebSocketServer(server: import("http").Server): void {
  wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (ws) => {
    logger.info("WebSocket client connected");

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });

    ws.on("close", () => {
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
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

export function broadcastTransaction(transaction: object): void {
  if (!wss) return;
  const payload = JSON.stringify({ type: "new_transaction", data: transaction });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}
