import "../globals.css";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Course } from "../../models/course.js";
import { Card, CardContent } from "@/ui/components/card";
import { Badge } from "@/ui/components/badge";

const STATUS_CONFIG: Record<
  Course["workflow_state"],
  { label: string; variant: "success" | "info" | "warning" | "danger" }
> = {
  available:   { label: "Active",      variant: "success" },
  completed:   { label: "Completed",   variant: "info" },
  unpublished: { label: "Unpublished", variant: "warning" },
  deleted:     { label: "Deleted",     variant: "danger" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CourseCard({ course }: { course: Course }) {
  const dateRange = [formatDate(course.start_at), formatDate(course.end_at)]
    .filter(Boolean)
    .join(" — ");
  const { label, variant } = STATUS_CONFIG[course.workflow_state];

  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 py-3">
        <div
          className="w-1 self-stretch shrink-0 rounded-full border border-border"
          style={{ background: course.course_color ?? "transparent" }}
        />

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">
            {course.name}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {course.course_code}
            {dateRange && <span className="ml-2">{dateRange}</span>}
          </div>
        </div>

        <Badge variant={variant}>{label}</Badge>
      </CardContent>
    </Card>
  );
}

function ListCourses() {
  const [courses, setCourses] = useState<Course[]>([]);

  const { app, error } = useApp({
    appInfo: { name: "Canvas LMS", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinput = (params) => {
        const input = params.arguments as { courses?: Course[] } | undefined;
        if (input?.courses) setCourses(input.courses);
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

      {app && courses.length === 0 && (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          Waiting for courses...
        </div>
      )}

      {courses.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground mb-3">
            {courses.length} course{courses.length !== 1 ? "s" : ""}
          </div>

          <div className="flex flex-col gap-2">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ListCourses />
  </StrictMode>,
);
