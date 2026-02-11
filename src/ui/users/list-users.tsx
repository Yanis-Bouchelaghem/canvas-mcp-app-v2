import "../globals.css";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { UserOutput } from "../../models/user.js";
import { Card, CardContent } from "@/ui/components/card";
import { Badge } from "@/ui/components/badge";

type DisplayUsersInput = { users?: UserOutput[] };

const ROLE_CONFIG: Record<string, { label: string; variant: "success" | "info" | "warning" | "danger" | "outline" }> = {
  teacher:  { label: "Teacher",  variant: "success" },
  student:  { label: "Student",  variant: "info" },
  ta:       { label: "TA",       variant: "warning" },
  designer: { label: "Designer", variant: "outline" },
  observer: { label: "Observer", variant: "outline" },
};

function UserAvatar({ src, name }: { src: string | null; name: string }) {
  const fallback = (
    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-secondary-foreground shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );

  if (!src) return fallback;

  return (
    <img
      src={src}
      alt={name}
      className="w-8 h-8 rounded-full object-cover shrink-0"
      onError={(e) => {
        e.currentTarget.style.display = "none";
        e.currentTarget.nextElementSibling?.classList.remove("hidden");
      }}
    />
  );
}

function UserCard({ user, app }: { user: UserOutput; app: ReturnType<typeof useApp>["app"] }) {
  return (
    <Card
      className={`py-0 ${user.html_url ? "cursor-pointer hover:bg-accent/50" : ""}`}
      onClick={() => user.html_url && app?.openLink({ url: user.html_url })}
    >
      <CardContent className="flex items-center gap-3 py-3">
        <UserAvatar src={user.avatar_url} name={user.name} />

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{user.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate italic">
            {user.email || "No email"}
          </div>
        </div>

        <div className="flex gap-1.5 shrink-0">
          {user.roles.map((role) => {
            const config = ROLE_CONFIG[role] ?? { label: role, variant: "secondary" as const };
            return (
              <Badge key={role} variant={config.variant}>{config.label}</Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ListUsers() {
  const [users, setUsers] = useState<UserOutput[]>([]);

  const { app, error } = useApp({
    appInfo: { name: "Canvas LMS", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinput = (params) => {
        const input = params.arguments as DisplayUsersInput | undefined;
        if (input?.users) setUsers(input.users);
      };
      app.onerror = console.error;
    },
  });

  useHostStyles(app, app?.getHostContext());

  return (
    <div className="min-h-full p-4 font-sans">
      {error && (
        <Card className="border-destructive">
          <CardContent className="text-sm text-destructive">
            Connection error: {error.message}
          </CardContent>
        </Card>
      )}

      {!app && !error && (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          Connecting...
        </div>
      )}

      {app && users.length === 0 && (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          Waiting for users...
        </div>
      )}

      {users.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground mb-3">
            {users.length} user{users.length !== 1 ? "s" : ""}
          </div>

          <div className="flex flex-col gap-2">
            {users.map((user, i) => (
              <UserCard key={user.email ?? i} user={user} app={app} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ListUsers />
  </StrictMode>,
);
