from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://kanban:kanban@db:5432/kanban"
    
    # JWT
    secret_key: str = "change-this-to-a-random-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    
    # App
    app_name: str = "Fun Kanban"
    debug: bool = False
    frontend_url: str = "http://localhost:8847"
    public_url: str = ""  # Public URL for email links (e.g., "https://kanban.example.com"). Falls back to frontend_url if empty.
    
    # Email templates
    email_company_name: str = ""  # e.g., "Cristian from Acme Corp"
    
    # Registration
    allow_registration: bool = True  # Set to false after creating admin
    first_user_is_admin: bool = True  # First registered user becomes admin
    
    # Features (local deployment only, not pushed to GitHub)
    show_pip_button: bool = False  # Show PIP button on Pip-AI workspace
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
