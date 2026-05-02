import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListNotificationsQueryKey, getGetUnreadCountQueryKey } from "@workspace/api-client-react";

export function useNotificationSocket() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetUnreadCountQueryKey() });
  }, [queryClient]);

  useEffect(() => {
    const token = localStorage.getItem("fraud_token");
    if (!token) return;

    const host = window.location.host;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${host}/api/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "notification") {
          invalidate();
        }
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
    };
  }, [invalidate]);
}
