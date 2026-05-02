import { useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { User, Shield } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  analyst: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  user: "bg-muted text-muted-foreground border-border",
};

export default function UsersPage() {
  const users = useListUsers({ query: { queryKey: getListUsersQueryKey() } });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">{users?.length ?? 0} registered users</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">User</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Email</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Role</th>
              <th className="text-left px-3 py-3 text-xs text-muted-foreground font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {!users || users.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-sm text-muted-foreground">No users found</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  data-testid={`row-user-${u.id}`}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {u.role === "admin" ? (
                          <Shield className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-primary" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-foreground">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[u.role] ?? ""}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
