import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications,
  useGetUnreadCount,
  useMarkNotificationRead,
  useMarkAllRead,
  useDeleteNotification,
  getListNotificationsQueryKey,
  getGetUnreadCountQueryKey,
} from "@workspace/api-client-react";
import { Bell, BellDot, Check, CheckCheck, Trash2, FolderOpen, MessageSquare, UserCheck, AlertCircle, X } from "lucide-react";

type AppNotification = {
  id: number;
  userId: number;
  type: string;
  title: string;
  message?: string | null;
  caseId?: number | null;
  isRead: boolean;
  createdAt: string;
};

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  case_created: { icon: FolderOpen, color: "text-blue-400" },
  case_assigned: { icon: UserCheck, color: "text-primary" },
  case_status_changed: { icon: AlertCircle, color: "text-amber-400" },
  note_added: { icon: MessageSquare, color: "text-green-400" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const notifQKey = getListNotificationsQueryKey();
  const countQKey = getGetUnreadCountQueryKey();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: notifQKey });
    queryClient.invalidateQueries({ queryKey: countQKey });
  };

  const { data: notifications = [] } = useListNotifications({ query: { queryKey: notifQKey, refetchInterval: 30000 } });
  const { data: countData } = useGetUnreadCount({ query: { queryKey: countQKey, refetchInterval: 30000 } });

  const unread = (countData as { count: number } | undefined)?.count ?? 0;
  const typed = notifications as AppNotification[];

  const markRead = useMarkNotificationRead({ mutation: { onSuccess: invalidate } });
  const markAll = useMarkAllRead({ mutation: { onSuccess: invalidate } });
  const deleteN = useDeleteNotification({ mutation: { onSuccess: invalidate } });

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleClick(n: AppNotification) {
    if (!n.isRead) markRead.mutate({ id: n.id });
    if (n.caseId) {
      navigate("/cases");
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
        aria-label="Notifications"
      >
        {unread > 0 ? (
          <BellDot className="w-5 h-5 text-primary" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1 leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {unread > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium border border-red-500/20">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  title="Mark all as read"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {typed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
                <Bell className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              typed.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? { icon: AlertCircle, color: "text-muted-foreground" };
                return (
                  <div
                    key={n.id}
                    className={`group flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 cursor-pointer transition hover:bg-muted/30 ${
                      !n.isRead ? "bg-primary/5" : ""
                    }`}
                    onClick={() => handleClick(n)}
                  >
                    {/* Icon */}
                    <div className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.color}`}>
                      <cfg.icon className="w-3.5 h-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug mb-0.5 ${n.isRead ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-snug">{n.message}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                      {!n.isRead && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markRead.mutate({ id: n.id }); }}
                          title="Mark read"
                          className="p-1 rounded text-muted-foreground hover:text-green-400 transition"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteN.mutate({ id: n.id }); }}
                        title="Delete"
                        className="p-1 rounded text-muted-foreground hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Unread dot */}
                    {!n.isRead && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {typed.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{typed.length} total</span>
              <button
                onClick={() => { navigate("/cases"); setOpen(false); }}
                className="text-[10px] text-primary hover:text-primary/80 transition font-medium"
              >
                View all cases →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
