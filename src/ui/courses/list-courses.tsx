import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Course } from "../../models/course.js";

const STATUS_CONFIG: Record<Course["workflow_state"], { label: string; bg: string; fg: string }> = {
  available:   { label: "Active",      bg: "var(--color-background-success, #dcfce7)", fg: "var(--color-text-success, #166534)" },
  completed:   { label: "Completed",   bg: "var(--color-background-info, #dbeafe)",    fg: "var(--color-text-info, #1e40af)" },
  unpublished: { label: "Unpublished", bg: "var(--color-background-warning, #fef9c3)", fg: "var(--color-text-warning, #854d0e)" },
  deleted:     { label: "Deleted",     bg: "var(--color-background-danger, #fee2e2)",  fg: "var(--color-text-danger, #991b1b)" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ state }: { state: Course["workflow_state"] }) {
  const { label, bg, fg } = STATUS_CONFIG[state];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "var(--border-radius-full, 9999px)",
      fontSize: "var(--font-text-xs-size, 0.75rem)",
      lineHeight: "var(--font-text-xs-line-height, 1rem)",
      fontWeight: "var(--font-weight-medium, 500)" as never,
      background: bg,
      color: fg,
    }}>
      {label}
    </span>
  );
}

function CourseCard({ course }: { course: Course }) {
  const dateRange = [formatDate(course.start_at), formatDate(course.end_at)].filter(Boolean).join(" — ");

  return (
    <div style={{
      padding: "12px 16px",
      borderRadius: "var(--border-radius-md, 8px)",
      border: "1px solid var(--color-border-primary, #e5e7eb)",
      background: "var(--color-background-secondary, transparent)",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      transition: "border-color 0.15s",
    }}>
      {course.course_color && (
        <div style={{
          width: 4,
          alignSelf: "stretch",
          borderRadius: "var(--border-radius-full, 9999px)",
          background: course.course_color,
          flexShrink: 0,
        }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: "var(--font-weight-semibold, 600)" as never,
          fontSize: "var(--font-text-sm-size, 0.875rem)",
          lineHeight: "var(--font-text-sm-line-height, 1.25rem)",
          color: "var(--color-text-primary, inherit)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {course.name}
        </div>
        <div style={{
          fontSize: "var(--font-text-xs-size, 0.75rem)",
          lineHeight: "var(--font-text-xs-line-height, 1rem)",
          color: "var(--color-text-secondary, #6b7280)",
          marginTop: 2,
        }}>
          {course.course_code}
          {dateRange && <span style={{ marginLeft: 8 }}>{dateRange}</span>}
        </div>
      </div>

      <StatusBadge state={course.workflow_state} />
    </div>
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
    <div style={{
      fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
      color: "var(--color-text-primary, inherit)",
      background: "var(--color-background-primary)",
      minHeight: "100%",
      padding: 16,
    }}>
      {error && (
        <div style={{
          padding: "12px 16px",
          borderRadius: "var(--border-radius-md, 8px)",
          background: "var(--color-background-danger, #fee2e2)",
          color: "var(--color-text-danger, #991b1b)",
          fontSize: "var(--font-text-sm-size, 0.875rem)",
        }}>
          Connection error: {error.message}
        </div>
      )}

      {!app && !error && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          color: "var(--color-text-secondary, #6b7280)",
          fontSize: "var(--font-text-sm-size, 0.875rem)",
        }}>
          Connecting...
        </div>
      )}

      {app && courses.length === 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          color: "var(--color-text-secondary, #6b7280)",
          fontSize: "var(--font-text-sm-size, 0.875rem)",
        }}>
          Waiting for courses...
        </div>
      )}

      {courses.length > 0 && (
        <>
          <div style={{
            fontSize: "var(--font-text-xs-size, 0.75rem)",
            color: "var(--color-text-secondary, #6b7280)",
            marginBottom: 12,
          }}>
            {courses.length} course{courses.length !== 1 ? "s" : ""}
          </div>

          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            overflowY: "auto",
          }}>
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
