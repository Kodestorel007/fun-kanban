from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID

# Auth schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

# User schemas
class UserBase(BaseModel):
    email: EmailStr
    display_name: str

class UserCreate(UserBase):
    password: Optional[str] = None  # Optional - if not provided, invite email is sent
    is_admin: bool = False
    is_guest: bool = False

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    theme: Optional[str] = None
    is_active: Optional[bool] = None

class UserPasswordReset(BaseModel):
    new_password: str

class UserResponse(BaseModel):
    id: UUID
    email: str
    display_name: str
    is_admin: bool
    is_guest: bool
    is_active: bool
    theme: str
    created_at: datetime

    class Config:
        from_attributes = True

# Workspace schemas
class WorkspaceBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#22c55e"

class WorkspaceCreate(WorkspaceBase):
    pass

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None

class WorkspaceMemberAdd(BaseModel):
    user_id: UUID
    role: str = "viewer"  # viewer, editor

class WorkspaceMemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_email: str
    user_name: str
    role: str
    created_at: datetime

class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    color: str
    owner_id: UUID
    owner_name: str
    member_count: int
    task_count: int
    display_order: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

# Project schemas
class ProjectBase(BaseModel):
    name: str
    color: Optional[str] = "#3b82f6"

class ProjectCreate(ProjectBase):
    workspace_id: UUID

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class ProjectResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    color: str
    created_at: datetime

    class Config:
        from_attributes = True

# Task schemas
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    due_date: Optional[date] = None

class TaskCreate(TaskBase):
    workspace_id: UUID
    project_id: Optional[UUID] = None
    status: Optional[str] = "todo"

class TaskUpdatePayload(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    blocked: Optional[bool] = None
    block_reason: Optional[str] = None
    on_hold: Optional[bool] = None
    hold_reason: Optional[str] = None
    due_date: Optional[date] = None
    project_id: Optional[UUID] = None
    position: Optional[int] = None
    assigned_to: Optional[UUID] = None

class TaskUpdateCreate(BaseModel):
    content: str

class TaskUpdateResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID]
    user_name: Optional[str]
    content: str
    created_at: datetime

class TaskResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    project_id: Optional[UUID]
    project_name: Optional[str]
    project_color: Optional[str]
    title: str
    description: Optional[str]
    status: str
    priority: str
    blocked: bool = False
    block_reason: Optional[str] = None
    on_hold: bool = False
    hold_reason: Optional[str] = None
    due_date: Optional[date] = None
    position: int
    created_by: Optional[UUID]
    assigned_to: Optional[UUID]
    assigned_to_name: Optional[str]
    updates: List[TaskUpdateResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Activity log schemas
class ActivityLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID]
    user_name: Optional[str]
    workspace_id: Optional[UUID]
    action: str
    entity_type: Optional[str]
    entity_id: Optional[UUID]
    details: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True

# Admin stats
class AdminStats(BaseModel):
    total_users: int
    active_users: int
    total_workspaces: int
    total_tasks: int
    tasks_by_status: dict

# SMTP Settings
class SMTPSettings(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Pip Kanban"
    smtp_use_tls: bool = True

# App Settings
class AppSettings(BaseModel):
    app_base_url: str = ""

# Password Reset
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# Notifications
class NotificationResponse(BaseModel):
    id: UUID
    type: str
    title: str
    message: str
    data: Optional[dict]
    read_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationCountResponse(BaseModel):
    unread_count: int
