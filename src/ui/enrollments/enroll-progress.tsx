import "../globals.css";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { Progress } from "../../models/progress.js";
import { Card, CardContent } from "@/ui/components/card";
import { Badge } from "@/ui/components/badge";

const STATUS_CONFIG: Record<
  Progress["workflow_state"],
  { label: string; variant: "success" | "info" | "warning" | "danger" }
> = {
  queued:    { label: "Queued",    variant: "warning" },
  running:   { label: "Running",   variant: "info" },
  completed: { label: "Completed", variant: "success" },
  failed:    { label: "Failed",    variant: "danger" },
};

const BAR_COLOR: Record<Progress["workflow_state"], string> = {
  queued:    "bg-warning-foreground",
  running:   "bg-info-foreground",
  completed: "bg-success-foreground",
  failed:    "bg-danger-foreground",
};

function ProgressBar({ value, state }: { value: number; state: Progress["workflow_state"] }) {
  return (
    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${BAR_COLOR[state]}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

interface EnrollInfo {
  userEmails: string[];
  courseNames: string[];
}

interface PersistedState {
  progress: Progress | null;
  info: EnrollInfo | null;
}

function EnrollProgress() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [info, setInfo] = useState<EnrollInfo | null>(null);
  const appRef = useRef<ReturnType<typeof useApp>["app"]>(null);
  const viewUUIDRef = useRef<string | undefined>(undefined);

  function saveState(p: Progress | null, i: EnrollInfo | null) {
    if (!viewUUIDRef.current) return;
    try {
      localStorage.setItem(viewUUIDRef.current, JSON.stringify({ progress: p, info: i } satisfies PersistedState));
    } catch { /* ignore */ }
  }

  const { app, error } = useApp({
    appInfo: { name: "Canvas LMS", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      appRef.current = app;
      app.ontoolinput = (params) => {
        const args = params.arguments as { user_emails?: string[]; course_names?: string[] } | undefined;
        if (args?.user_emails && args?.course_names) {
          setInfo({ userEmails: args.user_emails, courseNames: args.course_names });
        }
      };
      app.ontoolresult = (result) => {
        // Capture viewUUID and restore persisted state if available
        const uuid = result._meta?.viewUUID ? String(result._meta.viewUUID) : undefined;
        if (uuid) {
          viewUUIDRef.current = uuid;
          try {
            const saved = localStorage.getItem(uuid);
            if (saved) {
              const parsed = JSON.parse(saved) as PersistedState;
              if (parsed.progress) setProgress(parsed.progress);
              if (parsed.info) setInfo(parsed.info);
              return;
            }
          } catch { /* ignore */ }
        }

        // No persisted state — parse progress from tool result
        const text = result.content?.find((c) => c.type === "text") as { text: string } | undefined;
        if (text) {
          try {
            const parsed: Progress = JSON.parse(text.text);
            if (parsed.id) setProgress(parsed);
          } catch { /* ignore parse errors */ }
        }
      };
      app.onerror = console.error;
    },
  });

  useHostStyles(app, app?.getHostContext());

  // Poll for progress updates
  useEffect(() => {
    if (!progress || !appRef.current) return;
    if (progress.workflow_state === "completed" || progress.workflow_state === "failed") return;

    const interval = setInterval(async () => {
      try {
        const result = await appRef.current!.callServerTool({
          name: "get_enrollment_progress",
          arguments: { progress_id: progress.id },
        });
        if (result.isError) return;
        const text = result.content?.find((c: { type: string }) => c.type === "text") as { text: string } | undefined;
        if (text) {
          const updated: Progress = JSON.parse(text.text);
          setProgress(updated);
          saveState(updated, info);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [progress?.id, progress?.workflow_state]);

  const isDone = progress?.workflow_state === "completed" || progress?.workflow_state === "failed";
  const completion = progress?.completion ?? 0;
  const config = progress ? STATUS_CONFIG[progress.workflow_state] : null;

  function enrollLabel() {
    if (!info) return isDone ? "Enrollment complete" : "Enrolling…";
    const { userEmails, courseNames } = info;
    const users = `${userEmails.length} user${userEmails.length !== 1 ? "s" : ""}`;
    const courses = `${courseNames.length} course${courseNames.length !== 1 ? "s" : ""}`;
    return isDone
      ? `Enrolled ${users} into ${courses}`
      : `Enrolling ${users} into ${courses}...`;
  }

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

      {app && !progress && (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          Waiting for enrollment...
        </div>
      )}

      {progress && config && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{enrollLabel()}</span>
              <Badge variant={config.variant}>{config.label}</Badge>
            </div>

            <ProgressBar value={completion} state={progress.workflow_state} />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round(completion)}%</span>
              {progress.message && <span>{progress.message}</span>}
            </div>

            {isDone && progress.workflow_state === "failed" && (
              <div className="text-xs text-destructive">
                Enrollment failed. {progress.message || "Check Canvas for details."}
              </div>
            )}

            {info && (
              <div className="flex flex-col gap-2 mt-1">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Users</div>
                  <div className="flex flex-wrap gap-1">
                    {info.userEmails.map((email) => (
                      <Badge key={email} variant="outline">{email}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Courses</div>
                  <div className="flex flex-wrap gap-1">
                    {info.courseNames.map((name) => (
                      <Badge key={name} variant="outline">{name}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EnrollProgress />
  </StrictMode>,
);
