from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List, Optional
from datetime import datetime, timedelta
import uuid

from config import get_settings
from database import get_db, engine
from models import Base, User, Workspace, WorkspaceMember, Project, Task, TaskUpdate, ActivityLog, Session as DBSession, Notification
from schemas import *
from auth import (
    get_password_hash, verify_password, create_access_token, create_refresh_token,
    decode_token, get_current_user, get_current_admin
)

settings = get_settings()

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper to log activity
def log_activity(db: Session, user_id: uuid.UUID, workspace_id: uuid.UUID, action: str, 
                 entity_type: str = None, entity_id: uuid.UUID = None, details: dict = None):
    log = ActivityLog(
        user_id=user_id,
        workspace_id=workspace_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details
    )
    db.add(log)

# Helper to get effective from_email (falls back to smtp_user if from_email is empty)
def get_from_email(settings: dict) -> str:
    return settings.get('smtp_from_email') or settings.get('smtp_user', '')

# Helper to get base URL from site_settings (with fallback to config)
def get_base_url(db: Session) -> str:
    row = db.execute(text("SELECT value FROM site_settings WHERE key = 'app_base_url'")).fetchone()
    if row and row[0]:
        return row[0]
    # Fallback to config settings
    settings = get_settings()
    return settings.public_url or settings.frontend_url

# ==================== AUTH ROUTES ====================

@app.post("/api/auth/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    # Update last_login timestamp
    user.last_login = datetime.utcnow()
    db.commit()
    
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # Store refresh token
    db_session = DBSession(
        user_id=user.id,
        refresh_token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    )
    db.add(db_session)
    db.commit()
    
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

@app.post("/api/auth/register", response_model=TokenResponse)
def register(request: LoginRequest, db: Session = Depends(get_db)):
    # Check if registration is allowed
    user_count = db.query(User).count()
    is_first_user = user_count == 0
    
    if not is_first_user and not settings.allow_registration:
        raise HTTPException(status_code=403, detail="Registration is disabled")
    
    # Check if email already exists
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user (first user becomes admin)
    db_user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        display_name=request.email.split('@')[0],  # Default display name from email
        is_admin=is_first_user and settings.first_user_is_admin,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Auto-login after registration
    access_token = create_access_token(data={"sub": str(db_user.id)})
    refresh_token = create_refresh_token(data={"sub": str(db_user.id)})
    
    db_session = DBSession(
        user_id=db_user.id,
        refresh_token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    )
    db.add(db_session)
    db.commit()
    
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

@app.post("/api/auth/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(request.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    
    # Invalidate old refresh token
    db.query(DBSession).filter(DBSession.refresh_token == request.refresh_token).delete()
    
    access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    db_session = DBSession(
        user_id=user.id,
        refresh_token=new_refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    )
    db.add(db_session)
    db.commit()
    
    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)

@app.post("/api/auth/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(DBSession).filter(DBSession.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Logged out successfully"}

@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ==================== USER ROUTES ====================

@app.put("/api/users/me", response_model=UserResponse)
def update_me(update: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if update.display_name is not None:
        current_user.display_name = update.display_name
    if update.theme is not None:
        current_user.theme = update.theme
    db.commit()
    db.refresh(current_user)
    return current_user

# ==================== WORKSPACE ROUTES ====================

@app.get("/api/workspaces", response_model=List[WorkspaceResponse])
def get_workspaces(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Guests only see workspaces they're invited to
    if current_user.is_guest:
        workspaces = db.query(Workspace).join(WorkspaceMember).filter(
            WorkspaceMember.user_id == current_user.id
        ).all()
    else:
        # Regular users see owned + member workspaces
        owned = db.query(Workspace).filter(Workspace.owner_id == current_user.id).all()
        member_of = db.query(Workspace).join(WorkspaceMember).filter(
            WorkspaceMember.user_id == current_user.id
        ).all()
        workspaces = list(set(owned + member_of))
    
    result = []
    for ws in workspaces:
        owner = db.query(User).filter(User.id == ws.owner_id).first()
        member_count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws.id).count() + 1
        task_count = db.query(Task).filter(Task.workspace_id == ws.id).count()
        
        # Get user's display_order for this workspace
        membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == ws.id,
            WorkspaceMember.user_id == current_user.id
        ).first()
        display_order = membership.display_order if membership else 0
        
        result.append(WorkspaceResponse(
            id=ws.id,
            name=ws.name,
            description=ws.description,
            color=ws.color,
            owner_id=ws.owner_id,
            owner_name=owner.display_name if owner else "Unknown",
            member_count=member_count,
            task_count=task_count,
            display_order=display_order,
            created_at=ws.created_at
        ))
    
    # Sort by display_order
    result.sort(key=lambda x: x.display_order)
    return result

@app.post("/api/workspaces", response_model=WorkspaceResponse)
def create_workspace(workspace: WorkspaceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Guests cannot create workspaces
    if current_user.is_guest:
        raise HTTPException(status_code=403, detail="Guest users cannot create workspaces")
    
    db_workspace = Workspace(
        name=workspace.name,
        description=workspace.description,
        color=workspace.color,
        owner_id=current_user.id
    )
    db.add(db_workspace)
    db.commit()
    db.refresh(db_workspace)
    
    log_activity(db, current_user.id, db_workspace.id, "workspace_created", "workspace", db_workspace.id, {"name": workspace.name})
    db.commit()
    
    return WorkspaceResponse(
        id=db_workspace.id,
        name=db_workspace.name,
        description=db_workspace.description,
        color=db_workspace.color,
        owner_id=db_workspace.owner_id,
        owner_name=current_user.display_name,
        member_count=1,
        task_count=0,
        created_at=db_workspace.created_at
    )

@app.get("/api/workspaces/{workspace_id}")
def get_workspace(workspace_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Check access
    is_owner = workspace.owner_id == current_user.id
    is_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first() is not None
    
    if not is_owner and not is_member and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    owner = db.query(User).filter(User.id == workspace.owner_id).first()
    member_count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace.id).count() + 1
    task_count = db.query(Task).filter(Task.workspace_id == workspace.id).count()
    
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        color=workspace.color,
        owner_id=workspace.owner_id,
        owner_name=owner.display_name if owner else "Unknown",
        member_count=member_count,
        task_count=task_count,
        created_at=workspace.created_at
    )

@app.put("/api/workspaces/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(workspace_id: uuid.UUID, update: WorkspaceUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Check if owner or editor
    is_owner = workspace.owner_id == current_user.id
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first()
    is_editor = member and member.role == "editor"
    
    if not is_owner and not is_editor:
        raise HTTPException(status_code=403, detail="Only owner or editor can update workspace")
    
    if update.name is not None:
        workspace.name = update.name
    if update.description is not None:
        workspace.description = update.description
    if update.color is not None:
        workspace.color = update.color
    
    db.commit()
    db.refresh(workspace)
    
    log_activity(db, current_user.id, workspace_id, "workspace_updated", "workspace", workspace_id)
    db.commit()
    
    owner = db.query(User).filter(User.id == workspace.owner_id).first()
    member_count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace.id).count() + 1
    task_count = db.query(Task).filter(Task.workspace_id == workspace.id).count()
    
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        color=workspace.color,
        owner_id=workspace.owner_id,
        owner_name=owner.display_name if owner else "Unknown",
        member_count=member_count,
        task_count=task_count,
        created_at=workspace.created_at
    )

@app.delete("/api/workspaces/{workspace_id}")
def delete_workspace(workspace_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if workspace.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only owner can delete workspace")
    
    db.delete(workspace)
    db.commit()
    return {"message": "Workspace deleted"}

@app.put("/api/workspaces/reorder")
def reorder_workspaces(order: List[uuid.UUID], current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update display order for user's workspaces"""
    for idx, workspace_id in enumerate(order):
        # Update membership display_order
        membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id
        ).first()
        
        if membership:
            membership.display_order = idx
        else:
            # User might be owner without explicit membership - create one
            workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
            if workspace and workspace.owner_id == current_user.id:
                new_membership = WorkspaceMember(
                    workspace_id=workspace_id,
                    user_id=current_user.id,
                    role="owner",
                    display_order=idx
                )
                db.add(new_membership)
    
    db.commit()
    return {"message": "Workspace order updated"}

# ==================== WORKSPACE MEMBERS ====================

@app.get("/api/workspaces/{workspace_id}/members", response_model=List[WorkspaceMemberResponse])
def get_workspace_members(workspace_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Check access
    is_owner = workspace.owner_id == current_user.id
    is_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first() is not None
    
    if not is_owner and not is_member and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get owner
    owner = db.query(User).filter(User.id == workspace.owner_id).first()
    result = [WorkspaceMemberResponse(
        id=uuid.uuid4(),  # Fake ID for owner
        user_id=owner.id,
        user_email=owner.email,
        user_name=owner.display_name,
        role="owner",
        created_at=workspace.created_at
    )]
    
    # Get members
    members = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace_id).all()
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            result.append(WorkspaceMemberResponse(
                id=m.id,
                user_id=m.user_id,
                user_email=user.email,
                user_name=user.display_name,
                role=m.role,
                created_at=m.created_at
            ))
    
    return result

@app.post("/api/workspaces/{workspace_id}/members")
def add_workspace_member(workspace_id: uuid.UUID, member: WorkspaceMemberAdd, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Check if owner or editor
    is_owner = workspace.owner_id == current_user.id
    existing_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first()
    is_editor = existing_member and existing_member.role == "editor"
    
    if not is_owner and not is_editor:
        raise HTTPException(status_code=403, detail="Only owner or editor can add members")
    
    # Check if user exists
    user = db.query(User).filter(User.id == member.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already member
    existing = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == member.user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member")
    
    # Can't add owner as member
    if member.user_id == workspace.owner_id:
        raise HTTPException(status_code=400, detail="User is the workspace owner")
    
    db_member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=member.user_id,
        role=member.role,
        invited_by=current_user.id
    )
    db.add(db_member)
    
    log_activity(db, current_user.id, workspace_id, "member_added", "user", member.user_id, {"role": member.role, "user_email": user.email})
    
    # Notify existing workspace members about new member
    notify_workspace_members(
        db, workspace_id, current_user.id,
        "member_joined",
        f"{user.display_name} joined {workspace.name}",
        f"{user.display_name} was added to the workspace by {current_user.display_name}",
        {"workspace_id": str(workspace_id), "workspace_name": workspace.name, "user_name": user.display_name, "actor_name": current_user.display_name}
    )
    
    db.commit()
    
    # Send notification email
    workspace_url = f"{get_base_url(db)}/workspace/{workspace_id}"
    send_workspace_added_email(
        user.email, 
        user.display_name, 
        workspace.name, 
        member.role, 
        current_user.display_name,
        workspace_url, 
        db
    )
    
    return {"message": "Member added successfully"}

@app.put("/api/workspaces/{workspace_id}/members/{member_id}")
def update_workspace_member(workspace_id: uuid.UUID, member_id: uuid.UUID, role: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can change member roles")
    
    member = db.query(WorkspaceMember).filter(WorkspaceMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    if role not in ["viewer", "editor"]:
        raise HTTPException(status_code=400, detail="Role must be 'viewer' or 'editor'")
    
    member.role = role
    log_activity(db, current_user.id, workspace_id, "member_role_changed", "user", member.user_id, {"new_role": role})
    db.commit()
    
    return {"message": "Member role updated"}

@app.delete("/api/workspaces/{workspace_id}/members/{member_id}")
def remove_workspace_member(workspace_id: uuid.UUID, member_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    member = db.query(WorkspaceMember).filter(WorkspaceMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Owner can remove anyone, members can remove themselves
    if workspace.owner_id != current_user.id and member.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get user info before deleting
    removed_user = db.query(User).filter(User.id == member.user_id).first()
    removed_user_name = removed_user.display_name if removed_user else "A user"
    
    log_activity(db, current_user.id, workspace_id, "member_removed", "user", member.user_id)
    
    # Notify workspace members about removal
    notify_workspace_members(
        db, workspace_id, current_user.id,
        "member_left",
        f"{removed_user_name} left {workspace.name}",
        f"{removed_user_name} was removed from the workspace",
        {"workspace_id": str(workspace_id), "workspace_name": workspace.name, "user_name": removed_user_name, "actor_name": current_user.display_name}
    )
    
    db.delete(member)
    db.commit()
    
    return {"message": "Member removed"}

# ==================== PROJECT ROUTES ====================

@app.get("/api/workspaces/{workspace_id}/projects", response_model=List[ProjectResponse])
def get_projects(workspace_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check workspace access (simplified)
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    projects = db.query(Project).filter(Project.workspace_id == workspace_id).all()
    return projects

@app.post("/api/projects", response_model=ProjectResponse)
def create_project(project: ProjectCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == project.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Check edit access
    is_owner = workspace.owner_id == current_user.id
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == project.workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first()
    is_editor = member and member.role == "editor"
    
    if not is_owner and not is_editor:
        raise HTTPException(status_code=403, detail="Edit access required")
    
    db_project = Project(
        workspace_id=project.workspace_id,
        name=project.name,
        color=project.color
    )
    db.add(db_project)
    
    log_activity(db, current_user.id, project.workspace_id, "project_created", "project", db_project.id, {"name": project.name})
    db.commit()
    db.refresh(db_project)
    
    return db_project

@app.put("/api/projects/{project_id}", response_model=ProjectResponse)
def update_project(project_id: uuid.UUID, update: ProjectUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    workspace = db.query(Workspace).filter(Workspace.id == project.workspace_id).first()
    is_owner = workspace.owner_id == current_user.id
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == project.workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first()
    is_editor = member and member.role == "editor"
    
    if not is_owner and not is_editor:
        raise HTTPException(status_code=403, detail="Edit access required")
    
    if update.name:
        project.name = update.name
    if update.color:
        project.color = update.color
    
    log_activity(db, current_user.id, project.workspace_id, "project_updated", "project", project_id, {"name": project.name})
    db.commit()
    db.refresh(project)
    
    return project

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    workspace = db.query(Workspace).filter(Workspace.id == project.workspace_id).first()
    is_owner = workspace.owner_id == current_user.id
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == project.workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first()
    is_editor = member and member.role == "editor"
    
    if not is_owner and not is_editor:
        raise HTTPException(status_code=403, detail="Edit access required")
    
    # Delete all tasks in this project first
    task_count = db.query(Task).filter(Task.project_id == project_id).count()
    db.query(Task).filter(Task.project_id == project_id).delete()
    
    log_activity(db, current_user.id, project.workspace_id, "project_deleted", "project", project_id, {"name": project.name, "tasks_deleted": task_count})
    db.delete(project)
    db.commit()
    
    return {"message": f"Project deleted with {task_count} tasks"}

# ==================== TASK ROUTES ====================

@app.get("/api/workspaces/{workspace_id}/tasks", response_model=List[TaskResponse])
def get_tasks(workspace_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Check access
    is_owner = workspace.owner_id == current_user.id
    is_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first() is not None
    
    if not is_owner and not is_member and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    tasks = db.query(Task).filter(Task.workspace_id == workspace_id).order_by(Task.position).all()
    
    result = []
    for task in tasks:
        project = db.query(Project).filter(Project.id == task.project_id).first() if task.project_id else None
        assigned_user = db.query(User).filter(User.id == task.assigned_to).first() if task.assigned_to else None
        updates = db.query(TaskUpdate).filter(TaskUpdate.task_id == task.id).order_by(TaskUpdate.created_at.desc()).all()
        
        update_responses = []
        for u in updates:
            update_user = db.query(User).filter(User.id == u.user_id).first()
            update_responses.append(TaskUpdateResponse(
                id=u.id,
                user_id=u.user_id,
                user_name=update_user.display_name if update_user else None,
                content=u.content,
                created_at=u.created_at
            ))
        
        result.append(TaskResponse(
            id=task.id,
            workspace_id=task.workspace_id,
            project_id=task.project_id,
            project_name=project.name if project else None,
            project_color=project.color if project else None,
            title=task.title,
            description=task.description,
            status=task.status,
            priority=task.priority,
            blocked=task.blocked or False,
            block_reason=task.block_reason,
            on_hold=task.on_hold or False,
            due_date=task.due_date,
            position=task.position,
            created_by=task.created_by,
            assigned_to=task.assigned_to,
            assigned_to_name=assigned_user.display_name if assigned_user else None,
            updates=update_responses,
            created_at=task.created_at,
            updated_at=task.updated_at
        ))
    
    return result

@app.post("/api/tasks", response_model=TaskResponse)
def create_task(task: TaskCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == task.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Check edit access
    is_owner = workspace.owner_id == current_user.id
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == task.workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first()
    is_editor = member and member.role == "editor"
    
    if not is_owner and not is_editor:
        raise HTTPException(status_code=403, detail="Edit access required")
    
    # Get max position
    max_pos = db.query(func.max(Task.position)).filter(
        Task.workspace_id == task.workspace_id,
        Task.status == task.status
    ).scalar() or 0
    
    db_task = Task(
        workspace_id=task.workspace_id,
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        status=task.status or "todo",
        priority=task.priority,
        due_date=task.due_date,
        position=max_pos + 1,
        created_by=current_user.id
    )
    db.add(db_task)
    
    log_activity(db, current_user.id, task.workspace_id, "task_created", "task", db_task.id, {"title": task.title})
    db.commit()
    db.refresh(db_task)
    
    return TaskResponse(
        id=db_task.id,
        workspace_id=db_task.workspace_id,
        project_id=db_task.project_id,
        project_name=None,
        project_color=None,
        title=db_task.title,
        description=db_task.description,
        status=db_task.status,
        priority=db_task.priority,
        blocked=db_task.blocked or False,
        block_reason=db_task.block_reason,
        on_hold=db_task.on_hold or False,
        due_date=db_task.due_date,
        position=db_task.position,
        created_by=db_task.created_by,
        assigned_to=db_task.assigned_to,
        assigned_to_name=None,
        updates=[],
        created_at=db_task.created_at,
        updated_at=db_task.updated_at
    )

@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: uuid.UUID, update: TaskUpdatePayload, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    workspace = db.query(Workspace).filter(Workspace.id == task.workspace_id).first()
    is_owner = workspace.owner_id == current_user.id
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == task.workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first()
    is_editor = member and member.role == "editor"
    
    if not is_owner and not is_editor:
        raise HTTPException(status_code=403, detail="Edit access required")
    
    old_status = task.status
    
    if update.title is not None:
        task.title = update.title
    if update.description is not None:
        task.description = update.description
    if update.status is not None:
        task.status = update.status
    if update.priority is not None:
        task.priority = update.priority
    if update.blocked is not None:
        task.blocked = update.blocked
    if update.block_reason is not None:
        task.block_reason = update.block_reason
    if update.on_hold is not None:
        task.on_hold = update.on_hold
    if update.due_date is not None:
        task.due_date = update.due_date
    if update.project_id is not None:
        task.project_id = update.project_id
    if update.position is not None:
        task.position = update.position
    if update.assigned_to is not None:
        task.assigned_to = update.assigned_to
    
    action = "task_updated"
    if update.status and update.status != old_status:
        action = "task_moved"
        
        # Notify task creator if someone else moved their task
        if task.created_by and task.created_by != current_user.id:
            status_labels = {"todo": "To Do", "in_progress": "In Progress", "done": "Done", "archived": "Archived"}
            old_label = status_labels.get(old_status, old_status)
            new_label = status_labels.get(task.status, task.status)
            create_notification(
                db, task.created_by,
                "task_moved",
                f"Task moved: {task.title}",
                f"{current_user.display_name} moved your task from {old_label} → {new_label}",
                {"task_id": str(task.id), "workspace_id": str(task.workspace_id), "task_title": task.title, 
                 "old_status": old_status, "new_status": task.status, "actor_name": current_user.display_name}
            )
    
    log_activity(db, current_user.id, task.workspace_id, action, "task", task_id, {"title": task.title, "old_status": old_status, "new_status": task.status})
    db.commit()
    db.refresh(task)
    
    project = db.query(Project).filter(Project.id == task.project_id).first() if task.project_id else None
    assigned_user = db.query(User).filter(User.id == task.assigned_to).first() if task.assigned_to else None
    
    return TaskResponse(
        id=task.id,
        workspace_id=task.workspace_id,
        project_id=task.project_id,
        project_name=project.name if project else None,
        project_color=project.color if project else None,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        blocked=task.blocked or False,
        block_reason=task.block_reason,
        on_hold=task.on_hold or False,
        due_date=task.due_date,
        position=task.position,
        created_by=task.created_by,
        assigned_to=task.assigned_to,
        assigned_to_name=assigned_user.display_name if assigned_user else None,
        updates=[],
        created_at=task.created_at,
        updated_at=task.updated_at
    )

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    workspace = db.query(Workspace).filter(Workspace.id == task.workspace_id).first()
    is_owner = workspace.owner_id == current_user.id
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == task.workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first()
    is_editor = member and member.role == "editor"
    
    if not is_owner and not is_editor:
        raise HTTPException(status_code=403, detail="Edit access required")
    
    log_activity(db, current_user.id, task.workspace_id, "task_deleted", "task", task_id, {"title": task.title})
    db.delete(task)
    db.commit()
    
    return {"message": "Task deleted"}

@app.post("/api/tasks/{task_id}/updates")
def add_task_update(task_id: uuid.UUID, update: TaskUpdateCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db_update = TaskUpdate(
        task_id=task_id,
        user_id=current_user.id,
        content=update.content
    )
    db.add(db_update)
    
    # Truncate update content for notification message
    content_preview = update.content[:100] + "..." if len(update.content) > 100 else update.content
    
    # Collect users to notify (avoid duplicates)
    users_to_notify = set()
    
    # Notify task creator if commenter is not creator
    if task.created_by and task.created_by != current_user.id:
        users_to_notify.add(task.created_by)
    
    # Notify others who have commented on this task (except current user)
    previous_commenters = db.query(TaskUpdate.user_id).filter(
        TaskUpdate.task_id == task_id,
        TaskUpdate.user_id != current_user.id
    ).distinct().all()
    for (commenter_id,) in previous_commenters:
        if commenter_id:
            users_to_notify.add(commenter_id)
    
    # Create notifications
    for user_id in users_to_notify:
        # Determine notification type
        if user_id == task.created_by:
            notif_type = "task_update"
            title = f"Update on your task: {task.title}"
        else:
            notif_type = "task_update_reply"
            title = f"New comment on: {task.title}"
        
        create_notification(
            db, user_id,
            notif_type,
            title,
            f"{current_user.display_name}: {content_preview}",
            {"task_id": str(task.id), "workspace_id": str(task.workspace_id), "task_title": task.title, "actor_name": current_user.display_name}
        )
    
    db.commit()
    
    return {"message": "Update added"}

@app.delete("/api/tasks/{task_id}/updates/{update_id}")
def delete_task_update(task_id: uuid.UUID, update_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task_update = db.query(TaskUpdate).filter(TaskUpdate.id == update_id, TaskUpdate.task_id == task_id).first()
    if not task_update:
        raise HTTPException(status_code=404, detail="Update not found")
    
    # Only the author can delete their own update (or admin)
    if task_update.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="You can only delete your own updates")
    
    db.delete(task_update)
    db.commit()
    
    return {"message": "Update deleted"}

# ==================== NOTIFICATIONS ====================

def create_notification(db: Session, user_id: uuid.UUID, notification_type: str, title: str, message: str, data: dict = None):
    """Helper function to create a notification"""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        data=data
    )
    db.add(notification)
    # Don't commit here - let the caller handle the transaction

def notify_workspace_members(db: Session, workspace_id: uuid.UUID, exclude_user_id: uuid.UUID, 
                             notification_type: str, title: str, message: str, data: dict = None):
    """Notify all members of a workspace except the actor"""
    # Get workspace owner
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        return
    
    # Get all member user IDs
    member_ids = set()
    if workspace.owner_id != exclude_user_id:
        member_ids.add(workspace.owner_id)
    
    members = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace_id).all()
    for member in members:
        if member.user_id != exclude_user_id:
            member_ids.add(member.user_id)
    
    # Create notifications for each member
    for member_id in member_ids:
        create_notification(db, member_id, notification_type, title, message, data)

@app.get("/api/notifications", response_model=List[NotificationResponse])
def get_notifications(limit: int = 50, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user's notifications (newest first)"""
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(limit).all()
    return notifications

@app.get("/api/notifications/count", response_model=NotificationCountResponse)
def get_notification_count(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get count of unread notifications"""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read_at == None
    ).count()
    return NotificationCountResponse(unread_count=count)

@app.post("/api/notifications/mark-read")
def mark_notifications_read(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Mark all notifications as read"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read_at == None
    ).update({"read_at": datetime.utcnow()})
    db.commit()
    return {"message": "Notifications marked as read"}

@app.delete("/api/notifications/{notification_id}")
def delete_notification(notification_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a notification"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notification)
    db.commit()
    return {"message": "Notification deleted"}

# Cleanup old notifications (called periodically or on request)
@app.post("/api/notifications/cleanup")
def cleanup_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete old notifications: read > 7 days, unread > 30 days"""
    now = datetime.utcnow()
    
    # Delete read notifications older than 7 days
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read_at != None,
        Notification.read_at < now - timedelta(days=7)
    ).delete()
    
    # Delete unread notifications older than 30 days
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.created_at < now - timedelta(days=30)
    ).delete()
    
    db.commit()
    return {"message": "Old notifications cleaned up"}

# ==================== ADMIN ROUTES ====================

@app.get("/api/admin/stats", response_model=AdminStats)
def get_admin_stats(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    total_workspaces = db.query(Workspace).count()
    total_tasks = db.query(Task).count()
    
    tasks_by_status = {
        "todo": db.query(Task).filter(Task.status == "todo").count(),
        "in_progress": db.query(Task).filter(Task.status == "in_progress").count(),
        "done": db.query(Task).filter(Task.status == "done").count(),
        "archived": db.query(Task).filter(Task.status == "archived").count()
    }
    
    return AdminStats(
        total_users=total_users,
        active_users=active_users,
        total_workspaces=total_workspaces,
        total_tasks=total_tasks,
        tasks_by_status=tasks_by_status
    )

@app.get("/api/admin/users", response_model=List[UserResponse])
def get_all_users(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    users = db.query(User).all()
    return users

@app.post("/api/admin/users", response_model=UserResponse)
def create_user(user: UserCreate, current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    import secrets
    
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # If no password provided, this is an invite flow
    if not user.password:
        # Validate that app_base_url is configured before inviting
        base_url_row = db.execute(text("SELECT value FROM site_settings WHERE key = 'app_base_url'")).fetchone()
        if not base_url_row or not base_url_row[0]:
            raise HTTPException(status_code=400, detail="Please configure Application Base URL in Settings before inviting users")
        # Create user with a random unusable password
        temp_password = secrets.token_urlsafe(32)
        db_user = User(
            email=user.email,
            password_hash=get_password_hash(temp_password),
            display_name=user.display_name,
            is_admin=user.is_admin,
            is_guest=user.is_guest
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        # Generate invite token (same as password reset token)
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=48)  # 48 hours for invite
        
        db.execute(text("""
            INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES (:uid, :token, :expires)
        """), {"uid": db_user.id, "token": token, "expires": expires_at})
        db.commit()
        
        # Send invite email
        base_url = get_base_url(db)
        invite_url = f"{base_url}/reset-password?token={token}"
        send_invite_email(user.email, user.display_name, invite_url, db)
    else:
        # Direct creation with password (backward compatible)
        db_user = User(
            email=user.email,
            password_hash=get_password_hash(user.password),
            display_name=user.display_name,
            is_admin=user.is_admin,
            is_guest=user.is_guest
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    
    return db_user

@app.put("/api/admin/users/{user_id}", response_model=UserResponse)
def admin_update_user(user_id: uuid.UUID, update: UserUpdate, current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if update.display_name is not None:
        user.display_name = update.display_name
    if update.is_active is not None:
        user.is_active = update.is_active
    
    db.commit()
    db.refresh(user)
    return user

@app.post("/api/admin/users/{user_id}/reset-password")
def admin_reset_password(user_id: uuid.UUID, reset: UserPasswordReset, current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.password_hash = get_password_hash(reset.new_password)
    db.commit()
    
    return {"message": "Password reset successfully"}

@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: uuid.UUID, current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    db.delete(user)
    db.commit()
    
    return {"message": "User deleted"}

@app.get("/api/admin/workspaces", response_model=List[WorkspaceResponse])
def get_all_workspaces(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    workspaces = db.query(Workspace).all()
    result = []
    for ws in workspaces:
        owner = db.query(User).filter(User.id == ws.owner_id).first()
        member_count = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws.id).count() + 1
        task_count = db.query(Task).filter(Task.workspace_id == ws.id).count()
        result.append(WorkspaceResponse(
            id=ws.id,
            name=ws.name,
            description=ws.description,
            color=ws.color,
            owner_id=ws.owner_id,
            owner_name=owner.display_name if owner else "Unknown",
            member_count=member_count,
            task_count=task_count,
            created_at=ws.created_at
        ))
    return result

@app.get("/api/admin/activity", response_model=List[ActivityLogResponse])
def get_activity_log(limit: int = 100, current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    logs = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit).all()
    result = []
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first()
        result.append(ActivityLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_name=user.display_name if user else None,
            workspace_id=log.workspace_id,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            details=log.details,
            created_at=log.created_at
        ))
    return result

# ==================== SMTP SETTINGS ====================

@app.get("/api/admin/settings/smtp")
def get_smtp_settings(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    settings = {}
    rows = db.execute(text("SELECT key, value FROM site_settings WHERE key LIKE 'smtp_%'")).fetchall()
    for row in rows:
        settings[row[0]] = row[1]
    
    return SMTPSettings(
        smtp_host=settings.get('smtp_host', ''),
        smtp_port=int(settings.get('smtp_port', 587)),
        smtp_user=settings.get('smtp_user', ''),
        smtp_password='********' if settings.get('smtp_password') else '',  # Hide password
        smtp_from_email=settings.get('smtp_from_email', ''),
        smtp_from_name=settings.get('smtp_from_name', 'Kanban'),
        smtp_use_tls=settings.get('smtp_use_tls', 'true').lower() == 'true'
    )

@app.put("/api/admin/settings/smtp")
def update_smtp_settings(settings: SMTPSettings, current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    def upsert_setting(key: str, value: str):
        db.execute(text("""
            INSERT INTO site_settings (key, value, updated_at) 
            VALUES (:key, :value, NOW())
            ON CONFLICT (key) DO UPDATE SET value = :value, updated_at = NOW()
        """), {"key": key, "value": value})
    
    upsert_setting('smtp_host', settings.smtp_host)
    upsert_setting('smtp_port', str(settings.smtp_port))
    upsert_setting('smtp_user', settings.smtp_user)
    if settings.smtp_password and settings.smtp_password != '********':
        upsert_setting('smtp_password', settings.smtp_password)
    upsert_setting('smtp_from_email', settings.smtp_from_email)
    upsert_setting('smtp_from_name', settings.smtp_from_name)
    upsert_setting('smtp_use_tls', str(settings.smtp_use_tls).lower())
    
    db.commit()
    return {"message": "SMTP settings updated"}

@app.post("/api/admin/settings/smtp/test")
def test_smtp(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    import smtplib
    from email.mime.text import MIMEText
    
    # Get settings
    rows = db.execute(text("SELECT key, value FROM site_settings WHERE key LIKE 'smtp_%'")).fetchall()
    settings = {row[0]: row[1] for row in rows}
    
    if not settings.get('smtp_host'):
        raise HTTPException(status_code=400, detail="SMTP not configured")
    
    try:
        from_email = get_from_email(settings)
        msg = MIMEText("This is a test email from Kanban V2.")
        msg['Subject'] = "Kanban - SMTP Test"
        msg['From'] = f"{settings.get('smtp_from_name', 'Kanban')} <{from_email}>"
        msg['To'] = current_user.email
        
        if settings.get('smtp_use_tls', 'true').lower() == 'true':
            server = smtplib.SMTP(settings['smtp_host'], int(settings.get('smtp_port', 587)))
            server.starttls()
        else:
            server = smtplib.SMTP(settings['smtp_host'], int(settings.get('smtp_port', 587)))
        
        if settings.get('smtp_user') and settings.get('smtp_password'):
            server.login(settings['smtp_user'], settings['smtp_password'])
        
        server.sendmail(from_email, [current_user.email], msg.as_string())
        server.quit()
        
        return {"message": f"Test email sent to {current_user.email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMTP error: {str(e)}")

# ==================== APP SETTINGS ====================

@app.get("/api/admin/settings/app")
def get_app_settings(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    row = db.execute(text("SELECT value FROM site_settings WHERE key = 'app_base_url'")).fetchone()
    app_base_url = row[0] if row else ""
    return AppSettings(app_base_url=app_base_url)

@app.put("/api/admin/settings/app")
def update_app_settings(settings: AppSettings, current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    db.execute(text("""
        INSERT INTO site_settings (key, value, updated_at) 
        VALUES ('app_base_url', :value, NOW())
        ON CONFLICT (key) DO UPDATE SET value = :value, updated_at = NOW()
    """), {"value": settings.app_base_url})
    db.commit()
    return {"message": "App settings updated"}

# ==================== PASSWORD RESET ====================

import secrets

def send_reset_email(email: str, reset_url: str, db: Session):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    rows = db.execute(text("SELECT key, value FROM site_settings WHERE key LIKE 'smtp_%'")).fetchall()
    settings = {row[0]: row[1] for row in rows}
    
    if not settings.get('smtp_host'):
        return False
    
    try:
        from_email = get_from_email(settings)
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "Fun Kanban - Reset Your Password"
        msg['From'] = f"{settings.get('smtp_from_name', 'Fun Kanban')} <{from_email}>"
        msg['To'] = email
        
        text_body = f"""
Reset your Fun Kanban password by clicking the link below:

{reset_url}

This link expires in 1 hour.

If you didn't request this, you can ignore this email.
"""
        html = f"""
<html>
<body style="font-family: sans-serif; padding: 20px;">
    <h2 style="color: #22c55e;">Fun Kanban - Password Reset</h2>
    <p>Click the button below to reset your password:</p>
    <p style="margin: 30px 0;">
        <a href="{reset_url}" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Reset Password
        </a>
    </p>
    <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
    <p style="color: #666; font-size: 14px;">If you didn't request this, you can ignore this email.</p>
</body>
</html>
"""
        msg.attach(MIMEText(text_body, 'plain'))
        msg.attach(MIMEText(html, 'html'))
        
        if settings.get('smtp_use_tls', 'true').lower() == 'true':
            server = smtplib.SMTP(settings['smtp_host'], int(settings.get('smtp_port', 587)))
            server.starttls()
        else:
            server = smtplib.SMTP(settings['smtp_host'], int(settings.get('smtp_port', 587)))
        
        if settings.get('smtp_user') and settings.get('smtp_password'):
            server.login(settings['smtp_user'], settings['smtp_password'])
        
        server.sendmail(from_email, [email], msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send reset email: {e}")
        return False

def send_invite_email(email: str, display_name: str, invite_url: str, db: Session):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    rows = db.execute(text("SELECT key, value FROM site_settings WHERE key LIKE 'smtp_%'")).fetchall()
    settings = {row[0]: row[1] for row in rows}
    
    if not settings.get('smtp_host'):
        print("SMTP not configured - invite email not sent")
        return False
    
    try:
        from_email = get_from_email(settings)
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "Fun Kanban - You've been invited!"
        msg['From'] = f"{settings.get('smtp_from_name', 'Fun Kanban')} <{from_email}>"
        msg['To'] = email
        
        # Get company name from app settings
        from config import get_settings
        app_settings = get_settings()
        company_line = f", created by {app_settings.email_company_name}" if app_settings.email_company_name else ""
        
        text_body = f"""
Hi {display_name}!

You've been invited to join Fun Kanban{company_line} — an easy way to organize tasks and track progress together.

Click the link below to set your password and get started:

{invite_url}

This link expires in 48 hours.

See you there!
"""
        html = f"""
<html>
<body style="font-family: sans-serif; padding: 20px;">
    <h2 style="color: #22c55e;">Welcome to Fun Kanban! 🎉</h2>
    <p>Hi <strong>{display_name}</strong>!</p>
    <p>You've been invited to join <strong>Fun Kanban</strong>{company_line} — an easy way to organize tasks and track progress together.</p>
    <p>Click the button below to set your password and get started:</p>
    <p style="margin: 30px 0;">
        <a href="{invite_url}" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Set Your Password
        </a>
    </p>
    <p style="color: #666; font-size: 14px;">This link expires in 48 hours.</p>
    <p style="color: #666; font-size: 14px;">See you there!</p>
</body>
</html>
"""
        msg.attach(MIMEText(text_body, 'plain'))
        msg.attach(MIMEText(html, 'html'))
        
        if settings.get('smtp_use_tls', 'true').lower() == 'true':
            server = smtplib.SMTP(settings['smtp_host'], int(settings.get('smtp_port', 587)))
            server.starttls()
        else:
            server = smtplib.SMTP(settings['smtp_host'], int(settings.get('smtp_port', 587)))
        
        if settings.get('smtp_user') and settings.get('smtp_password'):
            server.login(settings['smtp_user'], settings['smtp_password'])
        
        server.sendmail(from_email, [email], msg.as_string())
        server.quit()
        print(f"Invite email sent to {email}")
        return True
    except Exception as e:
        print(f"Failed to send invite email: {e}")
        return False

def send_workspace_added_email(email: str, display_name: str, workspace_name: str, role: str, added_by: str, workspace_url: str, db: Session):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    rows = db.execute(text("SELECT key, value FROM site_settings WHERE key LIKE 'smtp_%'")).fetchall()
    settings = {row[0]: row[1] for row in rows}
    
    if not settings.get('smtp_host'):
        print("SMTP not configured - workspace added email not sent")
        return False
    
    try:
        from_email = get_from_email(settings)
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"Fun Kanban - You've been added to {workspace_name}!"
        msg['From'] = f"{settings.get('smtp_from_name', 'Fun Kanban')} <{from_email}>"
        msg['To'] = email
        
        role_display = "an Editor" if role == "editor" else "a Viewer"
        
        text_body = f"""
Hi {display_name}!

Great news! {added_by} has added you to the workspace "{workspace_name}" as {role_display}.

You can access the workspace here:
{workspace_url}

See you there!
"""
        html = f"""
<html>
<body style="font-family: sans-serif; padding: 20px;">
    <h2 style="color: #22c55e;">You've been added to a workspace! 🎉</h2>
    <p>Hi <strong>{display_name}</strong>!</p>
    <p>Great news! <strong>{added_by}</strong> has added you to the workspace "<strong>{workspace_name}</strong>" as {role_display}.</p>
    <p style="margin: 30px 0;">
        <a href="{workspace_url}" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Open Workspace
        </a>
    </p>
    <p style="color: #666; font-size: 14px;">See you there!</p>
</body>
</html>
"""
        msg.attach(MIMEText(text_body, 'plain'))
        msg.attach(MIMEText(html, 'html'))
        
        if settings.get('smtp_use_tls', 'true').lower() == 'true':
            server = smtplib.SMTP(settings['smtp_host'], int(settings.get('smtp_port', 587)))
            server.starttls()
        else:
            server = smtplib.SMTP(settings['smtp_host'], int(settings.get('smtp_port', 587)))
        
        if settings.get('smtp_user') and settings.get('smtp_password'):
            server.login(settings['smtp_user'], settings['smtp_password'])
        
        server.sendmail(from_email, [email], msg.as_string())
        server.quit()
        print(f"Workspace added email sent to {email}")
        return True
    except Exception as e:
        print(f"Failed to send workspace added email: {e}")
        return False

@app.post("/api/auth/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If the email exists, a reset link has been sent."}
    
    # Generate token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=1)
    
    # Invalidate old tokens
    db.execute(text("UPDATE password_reset_tokens SET used = TRUE WHERE user_id = :uid"), {"uid": user.id})
    
    # Create new token
    db.execute(text("""
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES (:uid, :token, :expires)
    """), {"uid": user.id, "token": token, "expires": expires_at})
    db.commit()
    
    # Build reset URL (frontend route)
    base_url = get_base_url(db)
    reset_url = f"{base_url}/reset-password?token={token}"
    
    # Send email
    send_reset_email(user.email, reset_url, db)
    
    return {"message": "If the email exists, a reset link has been sent."}

@app.post("/api/auth/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    # Find valid token
    result = db.execute(text("""
        SELECT user_id FROM password_reset_tokens 
        WHERE token = :token AND used = FALSE AND expires_at > NOW()
    """), {"token": request.token}).fetchone()
    
    if not result:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    
    user_id = result[0]
    
    # Update password
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    user.password_hash = get_password_hash(request.new_password)
    
    # Mark token as used
    db.execute(text("UPDATE password_reset_tokens SET used = TRUE WHERE token = :token"), {"token": request.token})
    db.commit()
    
    return {"message": "Password reset successfully"}

# ==================== CLIENT FEATURES ====================

@app.get("/api/features")
def get_client_features():
    """Public endpoint - no auth required - returns feature flags for client"""
    return {
        "show_pip_button": settings.show_pip_button,
    }

# ==================== HEALTH CHECK ====================

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "pip-kanban-v2"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
