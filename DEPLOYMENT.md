# Deployment & Operations Guide

**Last Updated:** Feb 13, 2026
**Platform:** Docker (OrbStack) on Mac Mini M4
**Access:** `http://192.168.0.100:8847` | `https://kanban.bidpointsolutions.com`

---

## Safety Rules

1. **Backup the database before taking containers down**
2. **Check what's running (`docker-compose ps`) before making changes**
3. **If unsure about an operation, ask first**

---

## Stack

| Service | Image | Port | Volume |
|---------|-------|------|--------|
| **PostgreSQL** | `postgres:16-alpine` | 5432 (internal) | `db_data` (persistent) |
| **FastAPI** | Custom (Python) | 8000 (internal) | &mdash; |
| **React/nginx** | Custom (Node build + nginx) | 8847 (exposed) | &mdash; |

All three services run in a shared Docker network. Only port 8847 is exposed to the host.

---

## Common Operations

### Deploy After Code Changes

```bash
cd "/Volumes/MakkStorage/Kanban Fix Me UP/Project"

# 1. Backup database
docker exec pip-kanban-v2-db-1 pg_dump -U kanban kanban > backup-$(date +%Y%m%d-%H%M).sql

# 2. Rebuild and restart
docker-compose down && docker-compose build && docker-compose up -d

# 3. Verify
docker-compose ps
docker-compose logs -f
```

### Frontend-Only Rebuild (Faster)

```bash
cd "/Volumes/MakkStorage/Kanban Fix Me UP/Project"
docker-compose up -d --build frontend
```

### Quick Restart (No Rebuild)

```bash
cd "/Volumes/MakkStorage/Kanban Fix Me UP/Project"
docker-compose restart
```

### View Logs

```bash
docker-compose logs -f          # All services
docker-compose logs -f api      # Backend only
docker-compose logs -f frontend # Frontend only
docker-compose logs -f db       # Database only
```

### Check Status

```bash
docker-compose ps
# Expect 3 containers: db, api, frontend — all "Up"
```

---

## Database Management

### Backup

```bash
docker exec pip-kanban-v2-db-1 pg_dump -U kanban kanban > backup-$(date +%Y%m%d).sql
```

### Restore

```bash
cat backup-YYYYMMDD.sql | docker exec -i pip-kanban-v2-db-1 psql -U kanban kanban
```

### Direct SQL Access

```bash
docker exec -it pip-kanban-v2-db-1 psql -U kanban kanban
```

```sql
-- Useful queries
SELECT * FROM users;
SELECT * FROM workspaces;
SELECT key, value FROM site_settings;
SELECT value FROM site_settings WHERE key = 'app_base_url';
```

---

## Environment Variables

Stored in `.env` at the project root. Never commit this file.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing key (change in production) |
| `FRONTEND_URL` | Frontend URL for CORS |
| `ALLOW_REGISTRATION` | Whether new users can self-register |
| `FIRST_USER_IS_ADMIN` | First registered user gets admin role |
| `EMAIL_COMPANY_NAME` | Branding in email templates |

SMTP settings and the Application Base URL are stored in the database (`site_settings` table) and configured via Admin > Settings.

---

## Networking

| Path | Address |
|------|---------|
| LAN | `http://192.168.0.100:8847` |
| Public | `https://kanban.bidpointsolutions.com` |
| Internal API | `http://api:8000` (Docker network) |
| Internal DB | `postgresql://kanban:kanban@db:5432/kanban` |

Public access is routed through Nginx Proxy Manager on a Raspberry Pi 4 with HTTPS termination.

### Firewall

If port 8847 is blocked by PF firewall, add exceptions in `/etc/pf.anchors/pip-ai-restrict`:

```
pass in quick proto tcp from any to any port 8847
pass out quick proto tcp from any port 8847 to any user 502
```

Reload: `sudo pfctl -f /etc/pf.conf`

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| Containers won't start | `docker-compose logs` for errors |
| Can't access from network | `lsof -i :8847` (port conflict), firewall rules |
| Invite emails show `localhost` | Set Application Base URL in Admin > Settings |
| Database lost after restart | Verify volume: `docker volume ls \| grep db_data` |
| Frontend shows stale version | Hard refresh browser, or rebuild: `docker-compose up -d --build frontend` |

---

## Post-Deployment Checklist

- [ ] All 3 containers running (`docker-compose ps`)
- [ ] UI loads at `http://192.168.0.100:8847`
- [ ] Login works
- [ ] Tasks load in workspace
- [ ] Admin settings preserved
- [ ] Mobile: scroll, tap, long-press all work
- [ ] Desktop: drag-and-drop between columns works

---

## Security Notes

- Passwords hashed with bcrypt
- JWT tokens with configurable expiration
- Database internal-only (not exposed to host)
- HTTPS handled by reverse proxy
- SMTP credentials stored in `site_settings` table

### Recommendations

- Rotate `SECRET_KEY` periodically
- Set `ALLOW_REGISTRATION=false` after initial setup
- Automate database backups
- Monitor failed login attempts
- Keep Docker images updated
