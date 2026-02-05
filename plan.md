# Canvas LMS MCP App - Project Plan

## Goal

Build an MCP App for Canvas LMS management. Helps LMS managers interact with their Canvas instance through an AI agent for:
- Course management
- Student enrollments
- Assignment tracking

## Project-Specific Details

**App Name:** Canvas LMS
**Version:** 1.0.0
**Resource URI:** `ui://canvas-lms/dashboard`

## Tool Domains

```
tools/
├── index.ts          # Registration logic
├── types.ts          # Canvas-specific types
├── courses.ts        # list_courses, create_course, update_course
├── students.ts       # list_students, enroll_student, drop_student
└── assignments.ts    # list_assignments, grade_assignment (future)
```

## Initial Tool: `canvas_dashboard`

| Mode | Description |
|------|-------------|
| UI | "Displays an interactive Canvas LMS dashboard" |
| Text | "Shows Canvas LMS status information" |

**Initial UI:** Connection status display, ready for Canvas API integration.

## Local Reference Files

Use these as reference implementations:

| File | Path |
|------|------|
| React example | `/home/yanis/ext-apps/examples/basic-server-react/src/mcp-app.tsx` |
| Server example | `/home/yanis/ext-apps/examples/basic-server-react/server.ts` |
| Main example | `/home/yanis/ext-apps/examples/basic-server-react/main.ts` |
| Vite config | `/home/yanis/ext-apps/examples/basic-server-react/vite.config.ts` |
| Package.json | `/home/yanis/ext-apps/examples/basic-server-react/package.json` |

## Verification

```bash
# Build and run
npm run build && npm run serve

# Test with basic-host
cd /home/yanis/ext-apps/examples/basic-host
SERVERS='["http://localhost:3001/mcp"]' npm run start
# Open http://localhost:8080
```

## Next Steps (After Base Works)

1. Canvas API integration (OAuth2, API token)
2. Implement `list_courses` with real Canvas data
3. Add student enrollment tools
4. Rich UI components for course/student display
