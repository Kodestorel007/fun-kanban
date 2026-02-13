"""
Seed script - initializes database tables
Run once after first deployment if tables don't exist
Note: First registered user becomes admin automatically!
"""
import os
from sqlalchemy import create_engine
from models import Base

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://kanban:kanban@localhost:5432/kanban")

def main():
    print("🔧 Initializing database...")
    engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created!")
    print("")
    print("📝 Next steps:")
    print("   1. Open http://localhost:8847")
    print("   2. Click 'Create account'")
    print("   3. First user becomes admin automatically!")

if __name__ == "__main__":
    main()
