import "../globals.css";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Card, CardContent } from "@/ui/components/card";
import { Badge } from "@/ui/components/badge";

interface UnenrollUser {
  enrollment_id: number;
  user_name: string;
  user_email: string;
  action: "conclude" | "delete" | "deactivate";
}

interface UnenrollCourse {
  course_id: number;
  course_name: string;
  users: UnenrollUser[];
}

type ApplyResult = { succeeded: number; failed: { enrollment_id: number; error: string }[] };
type Status = "preview" | "applying" | "done" | "cancelled";

const ACTION_CONFIG: Record<string, { label: string; variant: "warning" | "danger" | "info" }> = {
  conclude:   { label: "Conclude",   variant: "warning" },
  delete:     { label: "Delete",     variant: "danger" },
  deactivate: { label: "Deactivate", variant: "info" },
};

function UnenrollPreview() {
  const [courses, setCourses] = useState<UnenrollCourse[]>([]);
  const [status, setStatus] = useState<Status>("preview");
  const [result, setResult] = useState<ApplyResult | null>(null);
  const appRef = useRef<ReturnType<typeof useApp>["app"]>(null);

  const { app, error } = useApp({
    appInfo: { name: "Canvas LMS", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      appRef.current = app;
      app.ontoolinput = (params) => {
        const args = params.arguments as { courses?: UnenrollCourse[] } | undefined;
        if (args?.courses) setCourses(args.courses);
      };
      app.onerror = console.error;
    },
  });

  useHostStyles(app, app?.getHostContext());

  async function handleApply() {
    if (!appRef.current || courses.length === 0) return;
    setStatus("applying");

    try {
      const payload = courses.map((c) => ({
        course_id: c.course_id,
        users: c.users.map((u) => ({
          enrollment_id: u.enrollment_id,
          action: u.action,
        })),
      }));

      const res = await appRef.current.callServerTool({
        name: "apply_unenrollment",
        arguments: { courses: payload },
      });

      const text = res.content?.find((c: { type: string }) => c.type === "text") as { text: string } | undefined;
      if (text) {
        setResult(JSON.parse(text.text) as ApplyResult);
      }
    } catch {
      setResult({ succeeded: 0, failed: [{ enrollment_id: 0, error: "Failed to apply unenrollment" }] });
    }

    setStatus("done");
  }

  const totalUsers = courses.reduce((sum, c) => sum + c.users.length, 0);

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

      {app && courses.length === 0 && (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          Waiting for proposal...
        </div>
      )}

      {courses.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-muted-foreground">
            {totalUsers} enrollment{totalUsers !== 1 ? "s" : ""} across {courses.length} course{courses.length !== 1 ? "s" : ""}
          </div>

          {courses.map((course) => (
            <Card key={course.course_id}>
              <CardContent className="flex flex-col gap-2 py-3">
                <div className="text-sm font-semibold">{course.course_name}</div>

                {course.users.map((user) => {
                  const config = ACTION_CONFIG[user.action];
                  return (
                    <div key={user.enrollment_id} className="flex items-center gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{user.user_name}</span>
                        <span className="text-muted-foreground ml-1">({user.user_email})</span>
                      </div>
                      <span className="text-muted-foreground shrink-0">→</span>
                      <Badge variant={config.variant} className="shrink-0">{config.label}</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {status === "preview" && (
            <div className="flex gap-2 justify-end mt-1">
              <button
                onClick={() => setStatus("cancelled")}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-secondary text-secondary-foreground hover:bg-accent cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-destructive text-white hover:bg-destructive/90 cursor-pointer"
              >
                Apply unenrollment
              </button>
            </div>
          )}

          {status === "applying" && (
            <div className="text-xs text-muted-foreground text-center py-2">
              Applying unenrollments...
            </div>
          )}

          {status === "done" && result && (
            <Card className={result.failed.length > 0 ? "border-destructive" : "border-success"}>
              <CardContent className="py-3 text-xs">
                {result.succeeded > 0 && (
                  <div className="text-success-foreground">
                    {result.succeeded} enrollment{result.succeeded !== 1 ? "s" : ""} removed.
                  </div>
                )}
                {result.failed.length > 0 && (
                  <div className="text-destructive mt-1">
                    {result.failed.length} failed:
                    {result.failed.map((f) => (
                      <div key={f.enrollment_id} className="ml-2">Enrollment {f.enrollment_id}: {f.error}</div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {status === "cancelled" && (
            <div className="text-xs text-muted-foreground text-center py-2">
              Unenrollment cancelled.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UnenrollPreview />
  </StrictMode>,
);
