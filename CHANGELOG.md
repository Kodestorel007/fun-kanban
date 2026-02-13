# Changelog

All notable changes to Fun Kanban are documented here.

---

## [v2.1.0] - 2026-02-13

### Added - Desktop Enhancements

Seven UX improvements for the desktop board experience.

#### Cross-Column Drag-and-Drop
- Tasks can now be dragged **between columns** (e.g., To Do to In Progress), not just reordered within a column
- Each column wrapped in a `DroppableColumn` component using `useDroppable` from @dnd-kit/core
- Collision detection switched from `closestCenter` to `pointerWithin` for better cross-column accuracy
- Visual drop target indicator (dashed green outline) when hovering over a column

#### Task Sorting
- Sort buttons in the kanban header: **Due Date** and **Last Updated** (ascending/descending)
- Three-click cycle: ascending > descending > clear
- Tasks without a due date always sort to the bottom regardless of direction
- **Project Lock** toggle: when active, tasks stay grouped by project while sorting within each group

#### Collapsible Archived Column
- Archived column collapses to a narrow 48px vertical bar by default
- Vertical text label with task count
- Click to expand to full width; collapse button (`<<`) to fold it back
- Still accepts dropped tasks even when collapsed

#### Delete Button Redesign
- Circular delete button positioned at the top-right corner of each task card
- Circle extends 3/4 outside the card boundary
- Appears on hover with smooth fade-in
- Turns red with white X icon on hover

#### Task Card Separator
- Thin border line between the task content area and the footer (due date, last updated)

#### Mobile Header Actions
- Members and Manage Projects buttons now visible in the mobile workspace header
- Positioned to the right of the workspace name, matching the desktop layout

#### Removed Duplicate Button
- Removed redundant "Manage Projects" button from the kanban header toolbar (already accessible via cogwheel in the main header)

---

## [v2.0.0] - 2026-02-12

### Changed - Complete Frontend Rewrite

Full ground-up rewrite of all 31 frontend files. Every component, page, and the entire CSS stylesheet were rewritten from scratch while preserving the same API contract with the backend.

#### Why
Mobile was completely broken: single-finger scrolling didn't work, card taps were unreliable, the keyboard appeared randomly, and momentum scrolling couldn't be interrupted. Root cause: dnd-kit's `useSortable` hook registers internal event listeners that intercept touch events even when disabled, and the CSS had three competing `@media (max-width: 768px)` blocks with conflicting overflow rules.

#### Architecture Changes

**Split-component strategy:**
- `TaskCard.jsx` (desktop) uses full @dnd-kit with `useSortable`, hover effects, drag-and-drop
- `MobileTaskCard.jsx` (mobile) has zero dnd-kit imports, uses native `onClick` and passive `touchstart` listeners
- `WorkspacePage.jsx` renders completely separate JSX trees based on `isMobile` state

**Nuclear CSS scroll fix:**
- Rewrote ~3,500 lines of CSS from scratch (~1,200 lines clean)
- Single `@media (max-width: 768px)` block (eliminated three competing blocks)
- Strict overflow chain: every ancestor uses `overflow: hidden; flex: 1 1 0%; min-height: 0`
- Only `.column-tasks` scrolls (`position: absolute; inset: 0; overflow-y: auto`)
- `touch-action: manipulation` everywhere (not `pan-y` which iOS Safari doesn't fully support)
- `height: 100dvh` for iOS dynamic viewport height

**New components:**
- `PriorityMenu.jsx` — popup menu for priority selection (mobile)
- `MobileNav.jsx` — bottom tab navigation with column switching
- `MoveMenu.jsx` — long-press context menu with passive touch detection

**Layout fixes:**
- `Layout.jsx` sidebar DndContext uses empty `useSensors()` on mobile (prevents document-level touch listeners)
- Header switches from `position: sticky` to `position: relative` on mobile
- No `autoFocus` on any mobile-rendered input (prevents keyboard popup)

#### Files Rewritten (31 total)
- **Pages (7):** WorkspacePage, DashboardPage, AdminPage, LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage
- **Components (13):** Layout, TaskCard, MobileTaskCard, TaskModal, MobileNav, MoveMenu, PriorityMenu, NotificationBell, MembersModal, ManageProjectsModal, NewProjectModal, CreateWorkspaceModal, Toast
- **Context (2):** AuthContext, ThemeContext
- **Utilities (2):** api/client.js, utils/themeColors.js
- **Entry (2):** App.jsx, main.jsx
- **Styles (1):** index.css (full rewrite)
- **Config (4):** index.html, package.json, vite.config.js, nginx.conf

#### Mobile UX
- Single-finger scroll works on iOS Safari and Android Chrome
- Tap card opens edit modal
- Long-press (500ms) opens MoveMenu with haptic feedback
- Tap priority dot opens PriorityMenu popup
- Bottom nav switches between columns
- No zoom, no keyboard surprises, no momentum trapping

---

## [v1.2.0] - 2026-02-11

### Added - Application Base URL Setting

**Problem:** Invite emails contained `localhost` links instead of the actual domain, making invites unusable for remote users.

**Solution:** Configurable "Application Base URL" in Admin Settings, used for all email links (invites, password resets, workspace notifications).

#### Changes
- Backend: `get_base_url(db)` helper, GET/PUT `/api/admin/settings/app` endpoints
- Frontend: "Application Settings" section in Admin > Settings tab
- Validation: backend blocks invites if base URL is not configured
- Stored in `site_settings` table, persists across restarts

---

## [v1.1.0] - 2026-02-10

### Changed - Platform Migration: Podman to OrbStack

Replaced Podman VM with OrbStack for better macOS integration, native Docker CLI support, and simpler networking. No application code changes. Same port mapping (8847), same volume names.

---

## [v1.0.0] - 2026-02-08

### Initial Release

Multi-user Kanban board with workspaces, teams, and admin panel.

#### Core Features
- **Authentication:** JWT-based with refresh tokens and password reset
- **Workspaces:** Multiple boards per user, invite members with roles (Owner/Editor/Viewer)
- **Projects:** Color-coded project grouping within workspaces
- **Tasks:** Kanban columns (To Do, In Progress, Done), descriptions, priorities, assignments, due dates
- **Admin Panel:** User management, SMTP configuration, activity logs, statistics
- **Email:** Invite emails, password reset emails, workspace notifications
- **Dark Mode:** Default theme with toggle

#### Tech Stack
- **Backend:** FastAPI, PostgreSQL 16, SQLAlchemy
- **Frontend:** React 18, Vite 5, custom CSS
- **Infrastructure:** Docker Compose
- **Deployment:** Mac Mini M4, OrbStack

---

## Version History

| Version | Date | Summary |
|---------|------|---------|
| v2.1.0 | 2026-02-13 | Desktop enhancements: cross-column DnD, sorting, collapsible archive |
| v2.0.0 | 2026-02-12 | Complete frontend rewrite (31 files), mobile fix |
| v1.2.0 | 2026-02-11 | Application Base URL for email links |
| v1.1.0 | 2026-02-10 | Platform migration to OrbStack |
| v1.0.0 | 2026-02-08 | Initial release |

---

**Maintained by:** Pip AI
**For:** Cristian Man @ Bid Point Solutions
