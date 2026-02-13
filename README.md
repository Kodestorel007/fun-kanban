# Fun Kanban V2.1

A modern, self-hosted kanban board application built with React, FastAPI, and PostgreSQL. Features real-time collaboration, responsive design, and a comprehensive admin panel.

## Features

### Core Functionality
- **Kanban Board**: Drag-and-drop task management with customizable columns (To Do, In Progress, Done, Archive)
- **Workspaces**: Multi-workspace support with role-based access control
- **Task Management**: Priority indicators, due dates, assignments, descriptions, and activity tracking
- **Real-time Updates**: Live task updates across all connected clients
- **Responsive Design**: Fully optimized for desktop and mobile devices

### Administration
- **Admin Panel**: Comprehensive workspace and user management
- **User Roles**: Admin and guest user support with granular permissions
- **Activity Logging**: Track all workspace and task changes
- **Project Filtering**: Advanced filtering and sorting options

### Technical Features
- **Dark/Light Theme**: System-wide theme switching
- **Authentication**: Secure JWT-based authentication with refresh tokens
- **Database**: PostgreSQL 16 with optimized indexing
- **API**: RESTful API with FastAPI and automatic OpenAPI documentation
- **Self-Hosted**: Complete control over your data with Docker deployment

## Screenshots

### Login Screen
![Login Screen](../Screenshots/01-login-desktop.png)

### Dashboard
![Dashboard](../Screenshots/04-dashboard-desktop.png)

### Kanban Board - Desktop
![Kanban Board Desktop](../Screenshots/02-workspace-desktop.png)

### Kanban Board - Mobile
![Kanban Board Mobile](../Screenshots/03-workspace-mobile.png)

## Tech Stack

### Frontend
- React 18
- Vite
- React Beautiful DnD (drag-and-drop)
- Axios
- React Router

### Backend
- Python 3.11+
- FastAPI
- SQLAlchemy
- PostgreSQL 16
- JWT Authentication (PyJWT)
- Passlib (password hashing)

### Deployment
- Docker & Docker Compose
- Nginx (frontend serving)
- Uvicorn (ASGI server)

## Installation

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

### Quick Start

1. Clone the repository:
```bash
git clone https://github.com/Kodestorel007/fun-kanban.git
cd fun-kanban
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Configure your `.env` file:
```env
# Database
POSTGRES_USER=kanban
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=kanban

# Backend
SECRET_KEY=your_secret_key_here
DATABASE_URL=postgresql://kanban:your_secure_password_here@db:5432/kanban
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Ports
FRONTEND_PORT=8847
BACKEND_PORT=8000
```

4. Start the application:
```bash
docker-compose up -d
```

5. Access the application:
- Frontend: http://localhost:8847
- API Documentation: http://localhost:8000/docs

### Default Admin Account
On first run, create an admin account through the registration page or use the API directly.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | Database username | kanban |
| `POSTGRES_PASSWORD` | Database password | (required) |
| `POSTGRES_DB` | Database name | kanban |
| `SECRET_KEY` | JWT signing key | (required) |
| `DATABASE_URL` | Full database connection string | (auto-generated) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime | 30 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime | 7 |
| `FRONTEND_PORT` | Frontend port | 8847 |

### Docker Compose Profiles

The application uses standard Docker Compose configuration with three services:
- `db`: PostgreSQL database with persistent volume
- `api`: FastAPI backend
- `frontend`: Nginx-served React application

## API Documentation

Once running, visit http://localhost:8000/docs for interactive API documentation powered by Swagger UI.

### Key Endpoints

#### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - User logout

#### Workspaces
- `GET /workspaces` - List user workspaces
- `POST /workspaces` - Create workspace
- `GET /workspaces/{id}` - Get workspace details
- `PUT /workspaces/{id}` - Update workspace
- `DELETE /workspaces/{id}` - Delete workspace

#### Tasks
- `GET /workspaces/{workspace_id}/tasks` - List tasks
- `POST /workspaces/{workspace_id}/tasks` - Create task
- `PUT /tasks/{id}` - Update task
- `DELETE /tasks/{id}` - Delete task

## Development

### Running Locally

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Database Migrations

The application uses SQLAlchemy models. Database schema is created automatically on first run.

To inspect the database:
```bash
docker exec -it fun-kanban-db psql -U kanban -d kanban
```

## Production Deployment

### Security Recommendations

1. **Change Default Credentials**: Use strong, unique passwords for database and JWT secret
2. **HTTPS**: Deploy behind a reverse proxy (Nginx, Caddy) with SSL/TLS
3. **Firewall**: Restrict database port (5432) to localhost only
4. **Updates**: Keep Docker images and dependencies up to date
5. **Backups**: Regular database backups using `pg_dump`

### Backup Database
```bash
docker exec fun-kanban-db pg_dump -U kanban kanban > backup-$(date +%Y%m%d).sql
```

### Restore Database
```bash
cat backup.sql | docker exec -i fun-kanban-db psql -U kanban kanban
```

## Architecture

### Database Schema

Key tables:
- `users` - User accounts and authentication
- `workspaces` - Workspace configurations
- `workspace_members` - User-workspace associations
- `tasks` - Task data and metadata
- `task_updates` - Task activity history
- `notifications` - User notifications

### Frontend Structure
```
frontend/
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React context providers
│   ├── pages/         # Page-level components
│   ├── services/      # API service layer
│   └── utils/         # Utility functions
├── public/            # Static assets
└── index.html         # Entry point
```

### Backend Structure
```
backend/
├── main.py           # FastAPI application
├── config.py         # Configuration
├── database.py       # Database connection
├── models.py         # SQLAlchemy models
├── auth.py           # Authentication logic
├── routers/          # API route handlers
└── requirements.txt  # Python dependencies
```

## Troubleshooting

### Common Issues

**Database Connection Errors**
- Verify `DATABASE_URL` in `.env` matches container name `db`
- Check database container is healthy: `docker-compose ps`

**Frontend Can't Connect to Backend**
- Ensure backend is running on expected port
- Check CORS settings in `backend/main.py`

**Permission Errors**
- Verify Docker volumes have correct permissions
- Check container logs: `docker-compose logs -f`

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- GitHub Issues: https://github.com/Kodestorel007/fun-kanban/issues

## Roadmap

Planned features:
- Version history for tasks
- Autosave functionality
- Export to JSON/CSV
- Advanced user roles and permissions
- Comments and mentions
- Email notifications
- Analytics dashboard
- Calendar view
- Gantt chart view

---

Built by Bid Point Solutions - 2026
