"""Seed script to populate database with demo user, folders, files, tags, and activity."""

import asyncio
import os
import sys
import uuid

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.database import SessionLocal, Base, engine
from app.core.security import hash_password
from app.models.user import User
from app.models.folder import Folder
from app.models.file import File, FileVersion
from app.models.tag import Tag, FileTag
from app.models.activity import ActivityLog
from app.models.notification import Notification
from app.storage import get_storage_provider
from app.utils.hashing import calculate_sha256
from app.utils.file_utils import generate_storage_key


DEMO_EMAIL = "demo@cloudvault.com"
DEMO_PASSWORD = "DemoPassword123!"
DEMO_NAME = "Alex Taylor"


async def seed_database():
    print("Initializing CloudVault Database Schema...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    storage = get_storage_provider()

    try:
        # Check if demo user already exists
        existing_user = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if existing_user:
            print(f"Demo user '{DEMO_EMAIL}' already exists. Skipping seed.")
            return

        print("Creating demo user...")
        demo_user = User(
            email=DEMO_EMAIL,
            full_name=DEMO_NAME,
            password_hash=hash_password(DEMO_PASSWORD),
            storage_quota_bytes=1073741824,  # 1 GB
            storage_used_bytes=0,
            is_active=True,
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)

        # Create Folders
        print("Creating folders...")
        folder_docs = Folder(owner_id=demo_user.id, name="Documents")
        folder_projects = Folder(owner_id=demo_user.id, name="Projects")
        folder_photos = Folder(owner_id=demo_user.id, name="Media")
        db.add_all([folder_docs, folder_projects, folder_photos])
        db.commit()
        db.refresh(folder_projects)

        # Nested folder
        folder_subproject = Folder(
            owner_id=demo_user.id,
            parent_id=folder_projects.id,
            name="CloudVault SaaS",
        )
        db.add(folder_subproject)
        db.commit()

        # Create Tags
        print("Creating tags...")
        tag_important = Tag(user_id=demo_user.id, name="important")
        tag_work = Tag(user_id=demo_user.id, name="work")
        tag_notes = Tag(user_id=demo_user.id, name="notes")
        db.add_all([tag_important, tag_work, tag_notes])
        db.commit()
        db.refresh(tag_important)
        db.refresh(tag_work)

        # Create Sample Files
        print("Creating sample files in storage...")
        files_data = [
            (
                "Welcome_to_CloudVault.md",
                b"# Welcome to CloudVault\n\nCloudVault is a secure, modern cloud file storage and sharing platform.\n\n### Key Features:\n- Fast and secure file upload\n- Real-time previews\n- Granular sharing controls\n- File versioning\n- Responsive desktop & mobile design\n",
                "text/markdown",
                folder_docs.id,
                True,
            ),
            (
                "project_metrics_2026.csv",
                b"Month,Uploads,Downloads,StorageGB\nJan,120,450,12.5\nFeb,180,620,18.2\nMar,240,890,25.6\nApr,310,1100,34.1\nMay,420,1450,45.8\n",
                "text/csv",
                folder_subproject.id,
                False,
            ),
            (
                "system_architecture_overview.txt",
                b"CloudVault Architecture Overview\n===============================\nFrontend: Next.js 14, React 18, Tailwind CSS, Lucide icons\nBackend: FastAPI, SQLAlchemy 2.0, Pydantic v2\nStorage: Abstract Storage Interface (Local Filesystem / AWS S3 / MinIO)\nDatabase: PostgreSQL\nSecurity: Argon2id, JWT, Presigned URLs, RBAC\n",
                "text/plain",
                None,  # Root
                True,
            ),
        ]

        total_bytes = 0
        for filename, content, mime_type, fid, is_starred in files_data:
            size_bytes = len(content)
            total_bytes += size_bytes
            storage_key = generate_storage_key(demo_user.id, filename)
            await storage.save_file(storage_key, content)
            checksum = calculate_sha256(content)

            file_rec = File(
                owner_id=demo_user.id,
                folder_id=fid,
                original_filename=filename,
                storage_key=storage_key,
                mime_type=mime_type,
                size_bytes=size_bytes,
                checksum=checksum,
                is_starred=is_starred,
                current_version=1,
            )
            db.add(file_rec)
            db.flush()

            ver_rec = FileVersion(
                file_id=file_rec.id,
                version_number=1,
                storage_key=storage_key,
                size_bytes=size_bytes,
                checksum=checksum,
                uploaded_by=demo_user.id,
            )
            db.add(ver_rec)

            # Assign tags
            if is_starred:
                ft = FileTag(file_id=file_rec.id, tag_id=tag_important.id)
                db.add(ft)

        demo_user.storage_used_bytes = total_bytes
        db.commit()

        # Add Activity Logs
        print("Adding activity records...")
        activities = [
            ActivityLog(
                user_id=demo_user.id,
                action="account_created",
                resource_type="user",
                resource_name=DEMO_EMAIL,
            ),
            ActivityLog(
                user_id=demo_user.id,
                action="folder_created",
                resource_type="folder",
                resource_name="Documents",
            ),
            ActivityLog(
                user_id=demo_user.id,
                action="file_uploaded",
                resource_type="file",
                resource_name="Welcome_to_CloudVault.md",
                details={"size_bytes": 224, "mime_type": "text/markdown"},
            ),
            ActivityLog(
                user_id=demo_user.id,
                action="file_uploaded",
                resource_type="file",
                resource_name="system_architecture_overview.txt",
                details={"size_bytes": 280, "mime_type": "text/plain"},
            ),
        ]
        db.add_all(activities)

        # Add Notification
        notif = Notification(
            user_id=demo_user.id,
            type="welcome",
            title="Welcome to CloudVault!",
            message="Your secure personal cloud storage is ready. Start by uploading files or organizing into folders.",
            resource_type="system",
        )
        db.add(notif)
        db.commit()

        print("\n==========================================")
        print(" Demo Data Successfully Seeded!")
        print(" Email:    " + DEMO_EMAIL)
        print(" Password: " + DEMO_PASSWORD)
        print(" Full Name:" + DEMO_NAME)
        print("==========================================\n")

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(seed_database())
