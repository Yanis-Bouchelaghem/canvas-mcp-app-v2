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

interface EnrollCounts {
  userCount: number;
  courseCount: number;
}

function EnrollProgress() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [counts, setCounts] = useState<EnrollCounts | null>(null);
  const appRef = useRef<ReturnType<typeof useApp>["app"]>(null);

  const { app, error } = useApp({
    appInfo: { name: "Canvas LMS", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      appRef.current = app;
      app.ontoolinput = (params) => {
        const args = params.arguments as { user_ids?: number[]; course_ids?: number[] } | undefined;
        if (args?.user_ids && args?.course_ids) {
          setCounts({ userCount: args.user_ids.length, courseCount: args.course_ids.length });
        }
      };
      app.ontoolresult = (result) => {
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
    if (!counts) return isDone ? "Enrollment complete" : "Enrolling…";
    const { userCount, courseCount } = counts;
    const users = `${userCount} user${userCount !== 1 ? "s" : ""}`;
    const courses = `${courseCount} course${courseCount !== 1 ? "s" : ""}`;
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
