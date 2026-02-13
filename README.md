<p align="center">
  <img src="https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16">
  <img src="https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&logoColor=white" alt="Vite 5">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

<h1 align="center">Fun Kanban</h1>

<p align="center">
  <strong>Self-hosted Kanban board built for small teams.</strong><br>
  Workspaces, projects, drag-and-drop, member roles, dark mode, email invites.<br>
  Full mobile support. One command: <code>docker-compose up</code>
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#tech-stack">Tech Stack</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
  <a href="#documentation">Docs</a>
</p>

---

## Features

### Board & Tasks
- **Kanban columns** &mdash; To Do, In Progress, Done, Archived
- **Drag-and-drop** &mdash; reorder within columns and move between columns (desktop)
- **Task sorting** &mdash; sort by Due Date or Last Updated (ascending/descending)
- **Project Lock** &mdash; group tasks by project while sorting within each group
- **Collapsible Archived** &mdash; archived column folds into a slim vertical bar by default
- **Priority system** &mdash; low / medium / high with color-coded dots (click to cycle on desktop, popup menu on mobile)
- **Due dates, descriptions, progress notes** &mdash; full task editing in a modal
- **Block & Hold states** &mdash; mark tasks as blocked or on hold with reasons

### Workspaces & Collaboration
- **Multiple workspaces** &mdash; each with its own board, projects, and members
- **Member roles** &mdash; Owner, Editor, Viewer
- **Email invitations** &mdash; invite users via configurable SMTP
- **Project color-coding** &mdash; group and filter tasks by project with custom colors
- **Workspace reordering** &mdash; drag workspaces in the sidebar to reorder (desktop)

### Mobile
- **Dedicated mobile UI** &mdash; not a responsive hack, a separate rendering path
- **Native-feel scrolling** &mdash; single-finger scroll with interruptible momentum
- **Tap to edit, long-press to move** &mdash; context menu with haptic feedback
- **Bottom navigation** &mdash; swipe between columns via tab bar
- **Priority popup** &mdash; tap the dot to open a selection menu
- **No zoom, no keyboard surprises** &mdash; locked viewport, no stray focusable elements

### Admin & Settings
- **Admin panel** &mdash; user management, activity logs, system statistics
- **SMTP configuration** &mdash; configure email delivery from the UI
- **Application Base URL** &mdash; set the public domain used in all email links
- **Dark mode** &mdash; default theme, toggleable

### Security
- **JWT authentication** &mdash; access + refresh tokens with automatic renewal
- **Password reset** &mdash; email-based reset flow
- **Self-hosted** &mdash; your data stays on your server

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose

### Install & Run

```bash
# Clone
git clone https://github.com/Kodestorel007/fun-kanban.git
cd fun-kanban

# Configure
cp .env.example .env
nano .env  # Change SECRET_KEY at minimum

# Launch
docker-compose up -d

# Open
open http://localhost:8847
```

### First Login

1. Click **Create account**
2. Enter email and password
3. First user automatically becomes **admin**

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18.2, Vite 5 | SPA with hot reload |
| **Drag & Drop** | @dnd-kit/core, @dnd-kit/sortable | Cross-column DnD (desktop only) |
| **Icons** | Lucide React | Lightweight icon set |
| **Backend** | FastAPI, SQLAlchemy, Pydantic | REST API, ORM, validation |
| **Database** | PostgreSQL 16 | Persistent storage |
| **Auth** | JWT (python-jose), bcrypt | Access + refresh tokens |
| **Email** | SMTP (aiosmtplib) | Invites, password resets |
| **Container** | Docker, Docker Compose | Single-command deployment |
| **Web Server** | nginx (frontend), Uvicorn (backend) | Static serving + ASGI |

---

## Architecture

### Split-Component Mobile Strategy

Desktop and mobile use **completely separate rendering paths** in `WorkspacePage.jsx`:

- **Desktop**: Full `DndContext` + `SortableContext` + `TaskCard` (with `useSortable`) + `DragOverlay`
- **Mobile**: Plain `<div>` containers + `MobileTaskCard` (zero dnd-kit imports)

This eliminates the root cause of mobile touch issues: dnd-kit's `useSortable` hook registers event listeners that intercept single-finger touch events even when disabled.

### CSS Scroll Chain (Mobile)

A strict, unbroken overflow chain ensures exactly one scrollable element:

```
html, body, #root       height: 100%, touch-action: manipulation
  .app-layout            height: 100dvh, overflow: hidden, display: flex
    .main-content        flex: 1 1 0%, min-height: 0, overflow: hidden
      .page-content      flex: 1 1 0%, min-height: 0
        .workspace-page  flex: 1 1 0%, min-height: 0
          .kanban-board  flex: 1 1 0%, min-height: 0, overflow: hidden
            .kanban-column.mobile-active
              .column-tasks  position: absolute, inset: 0, overflow-y: auto
                              ^ THE ONLY SCROLLABLE ELEMENT
```

### Project Structure

```
fun-kanban/
├── backend/
│   ├── main.py            # FastAPI routes, email logic, business rules
│   ├── models.py          # SQLAlchemy models (User, Workspace, Task, etc.)
│   ├── schemas.py         # Pydantic request/response schemas
│   ├── auth.py            # JWT token creation & validation
│   ├── config.py          # Environment-based settings
│   ├── database.py        # DB connection & session
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── WorkspacePage.jsx    # Kanban board (desktop + mobile paths)
│   │   │   ├── DashboardPage.jsx    # Workspace overview
│   │   │   ├── AdminPage.jsx        # Admin panel (users, settings, logs)
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── ForgotPasswordPage.jsx
│   │   │   └── ResetPasswordPage.jsx
│   │   ├── components/
│   │   │   ├── Layout.jsx           # App shell, sidebar, header
│   │   │   ├── TaskCard.jsx         # Desktop task card (dnd-kit)
│   │   │   ├── MobileTaskCard.jsx   # Mobile task card (no dnd-kit)
│   │   │   ├── TaskModal.jsx        # Task edit modal
│   │   │   ├── MobileNav.jsx        # Bottom tab navigation
│   │   │   ├── MoveMenu.jsx         # Long-press context menu
│   │   │   ├── PriorityMenu.jsx     # Priority selection popup
│   │   │   ├── NotificationBell.jsx # Real-time notification indicator
│   │   │   ├── MembersModal.jsx     # Workspace member management
│   │   │   ├── ManageProjectsModal.jsx
│   │   │   ├── NewProjectModal.jsx
│   │   │   ├── CreateWorkspaceModal.jsx
│   │   │   └── Toast.jsx            # Toast notifications
│   │   ├── context/
│   │   │   ├── AuthContext.jsx      # JWT auth state & token refresh
│   │   │   └── ThemeContext.jsx     # Dark/light theme toggle
│   │   ├── api/
│   │   │   └── client.js           # Axios API client
│   │   └── utils/
│   │       └── themeColors.js      # Theme-aware color utilities
│   ├── public/
│   └── package.json
├── db/                     # Database init scripts
├── docker-compose.yml
├── .env.example
├── CHANGELOG.md
├── DEPLOYMENT.md
├── LICENSE
└── README.md
```

---

## Configuration

### Environment Variables

Create `.env` from the template:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://kanban:kanban@db:5432/kanban` |
| `SECRET_KEY` | JWT signing key (**must change**) | &mdash; |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:8847` |
| `ALLOW_REGISTRATION` | Open registration | `true` |
| `FIRST_USER_IS_ADMIN` | First user gets admin role | `true` |
| `EMAIL_COMPANY_NAME` | Branding for email templates | &mdash; |

### Email (Optional)

Configure SMTP in **Admin Panel > Settings**:
- Host, port, username, password
- From address and display name
- Application Base URL (used in all email links)

---

## Security

- Change `SECRET_KEY` before deploying
- Run behind a reverse proxy with HTTPS (nginx, Caddy, Traefik)
- Set `ALLOW_REGISTRATION=false` after creating initial users
- Keep `.env` out of version control
- Database is internal-only (not exposed to host network)

---

## Documentation

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](CHANGELOG.md) | Version history with detailed changes |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Operations guide: deploy, backup, troubleshoot |
| [docs/MOBILE-UX-PATTERNS.md](docs/MOBILE-UX-PATTERNS.md) | Mobile touch behavior specification |
| [.env.example](.env.example) | Environment variable template |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit changes (`git commit -m 'Add your feature'`)
4. Push (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

MIT License &mdash; see [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with mass amounts of coffee<br>
  <sub>Maintained by Pip AI for Bid Point Solutions</sub>
</p>
