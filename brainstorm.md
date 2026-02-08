For the two scenarios (enrollment blitz + student transfer):

Tool	Purpose
list_courses	Starting point — see available courses
list_users_in_course	See who's in a course (also needed for transfer scenario)
check_students_exist	Resolve emails → existing user or None
enroll_students_to_courses	Bulk enroll existing students (by ID)
invite_students_to_courses	Bulk invite new students (by email, sequential internally)
unenroll_user	Remove a student from a course (transfer scenario)


# Canvas LMS Agent - Usage Scenarios & Flows

## Context

A chat-based agent (MCP App in CopilotKit) that helps school principals and teachers manage their Canvas LMS instance through natural language. The agent has access to tools for courses, enrollments, and user progress, and can display rich UIs for results.

---

## Persona: School Principal

### Scenario 1: "Start of Year Enrollment Blitz"
> **Trigger:** Hundreds of students need to be enrolled in the right courses at the start of a semester.

**Flow:**
1. Principal asks: *"Show me all courses for this semester"*
   - **Tool:** `list_courses` -> displays course list UI with filters (term, status)
2. Principal asks: *"Enroll these 30 students into Biology 101 and Chemistry 201"*
   - Agent might ask for clarification: student IDs, enrollment type (student/observer)
   - **Tool:** `bulk_enroll` -> displays enrollment confirmation UI (who got enrolled where, any failures)
3. Principal asks: *"Now show me who's in Biology 101"*
   - **Tool:** `list_users_in_course` -> displays roster UI

**Why it's useful:** Currently this is a tedious manual process in Canvas admin. Doing it through chat with bulk operations saves hours.

---

### Scenario 2: "Mid-Semester Progress Check"
> **Trigger:** Principal wants to identify struggling students across the school.

**Flow:**
1. Principal asks: *"Show me progress for all students in Algebra II"*
   - **Tool:** `bulk_user_progress` -> displays a dashboard/table UI showing each student's progress, completion %, modules completed
2. Principal notices some students are behind and asks: *"Which students are below 50% completion?"*
   - Agent filters the data and highlights at-risk students
3. Principal asks: *"Show me Sarah Johnson's progress across all her courses"*
   - **Tool:** `user_progress_all_courses` (iterates over user's courses) -> displays a per-course progress report UI
4. Principal asks: *"What courses is Sarah enrolled in?"*
   - **Tool:** `user_enrollments` -> displays enrollment list with roles, status, grades

**Why it's useful:** Principals currently need to click into each course individually in Canvas. This gives them a bird's-eye view across the whole school.

---

### Scenario 3: "Student Transfer / Schedule Change"
> **Trigger:** A student is transferring classes mid-semester.

**Flow:**
1. Principal asks: *"Show me Jamie Rodriguez's current enrollments"*
   - **Tool:** `user_enrollments` -> displays current courses
2. Principal says: *"Remove Jamie from French II and enroll them in Spanish I"*
   - **Tool:** `unenroll_user` (conclude/deactivate enrollment in French II)
   - **Tool:** `enroll_user` (add to Spanish I)
   - UI shows confirmation of both actions with before/after state
3. Principal asks: *"Confirm Jamie's updated schedule"*
   - **Tool:** `user_enrollments` -> shows refreshed enrollment list

**Why it's useful:** This is a 2-minute conversation vs. navigating multiple Canvas admin screens.

---

### Scenario 4: "Teacher Left Mid-Year / Emergency Staffing"
> **Trigger:** A teacher suddenly leaves. Principal needs to understand impact and reassign.

**Flow:**
1. Principal asks: *"What courses does Mr. Thompson teach?"*
   - **Tool:** `list_courses_for_user` (for Mr. Thompson) -> shows his courses
2. Principal asks: *"How many students are in each of those courses?"*
   - **Tool:** `list_users_in_course` (for each course) -> student counts
3. Principal says: *"Deactivate Mr. Thompson's enrollment in all his courses"*
   - **Tool:** `unenroll_user` (deactivate for each course) -> confirmation
4. Principal says: *"Enroll Ms. Garcia as teacher in all three courses"*
   - **Tool:** `bulk_enroll` (with teacher role) -> confirmation

**Why it's useful:** Emergency staffing changes require fast, accurate admin actions across multiple courses.

---

### Scenario 5: "Board Meeting Preparation / Reporting"
> **Trigger:** Principal needs to prepare data for a school board presentation.

**Flow:**
1. Principal asks: *"Give me an overview of all active courses"*
   - **Tool:** `list_courses` -> full course listing with enrollment counts
2. Principal asks: *"Show me completion rates for the AP courses"*
   - **Tool:** `bulk_user_progress` (for each AP course) -> progress dashboards
3. Principal asks: *"Which courses have the lowest average student progress?"*
   - Agent aggregates data across courses and ranks them
   - UI displays a summary/ranking table

**Why it's useful:** Data gathering that would take hours of clicking through Canvas is done through conversation.

---

## Persona: Teacher / Department Head

### Scenario 6: "Daily Class Management"
> **Trigger:** Teacher wants to check on their classes and students.

**Flow:**
1. Teacher asks: *"Show me my courses"*
   - **Tool:** `list_courses_for_user` (for authenticated user) -> course list
2. Teacher asks: *"Who's falling behind in my World History class?"*
   - **Tool:** `bulk_user_progress` -> progress table, agent highlights stragglers
3. Teacher asks: *"Show me the full progress report for Alex Chen"*
   - **Tool:** `user_progress` (specific course) -> detailed module-by-module view

---

### Scenario 7: "New Student Arrives Mid-Semester"
> **Trigger:** A new student needs to be added to specific courses.

**Flow:**
1. Teacher asks: *"Add new student Maria Lopez (ID: 12345) to my English Literature course"*
   - **Tool:** `enroll_user` -> confirmation with enrollment details
2. Teacher asks: *"Also add her as an observer to the Parent Portal"*
   - **Tool:** `enroll_user` (observer role) -> confirmation

---

### Scenario 8: "End of Semester Cleanup"
> **Trigger:** Semester is ending, need to conclude enrollments and review.

**Flow:**
1. Department head asks: *"Show me all students who haven't completed any modules in Chemistry 101"*
   - **Tool:** `bulk_user_progress` -> filtered to 0% progress students
2. Department head says: *"Conclude the enrollments for these 5 students who dropped out"*
   - **Tool:** `unenroll_user` (conclude) for each -> confirmation
3. Department head asks: *"Actually, re-enroll student #3, they want to come back"*
   - **Tool:** `reactivate_enrollment` -> confirmation

---

## Key UX Observations & Flow Patterns

### Pattern: Tool Chaining
Most real scenarios involve **2-4 tools in sequence**. The agent should:
- Remember context from previous tool calls (e.g., "those students" refers to the last result)
- Offer logical next actions ("Would you like to see their enrollments?")
- Allow referring to results by natural language ("the third student", "the AP courses")

### Pattern: Overview -> Drill Down -> Action
Almost every scenario follows this pattern:
1. **Overview**: List courses / list users / show enrollments
2. **Drill Down**: Progress for specific student / specific course details
3. **Action**: Enroll / unenroll / reactivate

### Pattern: Bulk Operations with Confirmation
For any destructive or bulk action, the UI should:
1. Show a preview of what will happen
2. Require confirmation
3. Show results (successes + failures)

### Pattern: Cross-Course Aggregation
Principals especially need **cross-course views** that Canvas doesn't natively provide well:
- Student progress across ALL courses (not just one)
- Course health rankings (which courses have low engagement?)
- Enrollment summaries across the school

---

## Considerations for the Agent

### Authentication Tiers
The user mentioned two tiers:
- **Free/Basic integration**: API token, can do most things but some require iterating over all courses
- **Admin/Proper integration**: OAuth2 with admin privileges, can observe users globally

The agent should gracefully handle both - if it can't get all-courses-for-user directly, it should iterate and let the user know it might take a moment.

### Error Scenarios the Agent Should Handle
- Student not found
- Course not found
- Permission denied (not admin)
- Enrollment already exists
- Can't unenroll (active submissions/grades)
- Rate limiting from Canvas API

### UI Considerations
Each tool's UI should be designed for its most common use:
- **Course lists**: Sortable table with search/filter
- **User lists/rosters**: Table with role badges, status indicators
- **Progress reports**: Visual progress bars, color-coded (red/yellow/green)
- **Enrollment confirmations**: Clear success/failure states
- **Bulk operations**: Progress indicator, summary of results

---

## Summary: Tool Priority by Impact

| Priority | Tool | Why |
|----------|------|-----|
| 1 | `list_courses` | Starting point for almost every flow |
| 2 | `bulk_user_progress` | Highest value - the "at-risk students" view principals want most |
| 3 | `list_users_in_course` | Essential for any course-level operation |
| 4 | `user_enrollments` | Critical for student-centric flows |
| 5 | `enroll_user` | Core administrative action |
| 6 | `user_progress` (single) | Drill-down from bulk view |
| 7 | `bulk_enroll` | High impact but less frequent |
| 8 | `unenroll/conclude` | Administrative necessity |
| 9 | `list_courses_for_user` | Nice-to-have, admin-only |
| 10 | `reactivate_enrollment` | Edge case but needed |
