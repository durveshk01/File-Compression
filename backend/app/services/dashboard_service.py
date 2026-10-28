"""Dashboard analytics and statistics service."""

import uuid
from collections import defaultdict
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, desc

from app.models.file import File
from app.models.folder import Folder
from app.models.user import User
from app.models.share import FileShare
from app.models.activity import ActivityLog
from app.schemas.dashboard import DashboardStatsResponse, FileTypeStat, StorageUsageResponse
from app.schemas.file import FileResponse
from app.schemas.activity import ActivityResponse
from app.utils.file_utils import get_file_category


class DashboardService:
    @staticmethod
    def get_dashboard_stats(db: Session, user: User) -> DashboardStatsResponse:
        # File counts
        total_files = db.scalar(
            select(func.count(File.id)).where(
                File.owner_id == user.id,
                File.is_trashed.is_(False),
            )
        ) or 0

        # Folder counts
        total_folders = db.scalar(
            select(func.count(Folder.id)).where(
                Folder.owner_id == user.id,
                Folder.is_trashed.is_(False),
            )
        ) or 0

        # Starred files count
        starred_files_count = db.scalar(
            select(func.count(File.id)).where(
                File.owner_id == user.id,
                File.is_starred.is_(True),
                File.is_trashed.is_(False),
            )
        ) or 0

        # Trash files count
        trash_files_count = db.scalar(
            select(func.count(File.id)).where(
                File.owner_id == user.id,
                File.is_trashed.is_(True),
            )
        ) or 0

        # Shared files count
        shared_files_count = db.scalar(
            select(func.count(FileShare.id)).where(
                FileShare.shared_by == user.id,
            )
        ) or 0

        # Category breakdown
        files = db.scalars(
            select(File).where(File.owner_id == user.id, File.is_trashed.is_(False))
        ).all()

        category_counts: dict[str, int] = defaultdict(int)
        category_bytes: dict[str, int] = defaultdict(int)
        for f in files:
            cat = get_file_category(f.original_filename, f.mime_type)
            category_counts[cat] += 1
            category_bytes[cat] += f.size_bytes

        file_type_distribution = [
            FileTypeStat(
                category=cat,
                count=count,
                size_bytes=category_bytes[cat],
            )
            for cat, count in category_counts.items()
        ]

        # Recent files
        recent_files_query = (
            select(File)
            .options(joinedload(File.file_tags))
            .where(File.owner_id == user.id, File.is_trashed.is_(False))
            .order_by(desc(File.created_at))
            .limit(5)
        )
        recent_files_models = list(db.scalars(recent_files_query).unique().all())
        recent_files = [FileResponse.model_validate(f) for f in recent_files_models]

        # Recent activities
        recent_act_query = (
            select(ActivityLog)
            .where(ActivityLog.user_id == user.id)
            .order_by(desc(ActivityLog.created_at))
            .limit(8)
        )
        recent_act_models = list(db.scalars(recent_act_query).all())
        recent_activities = [ActivityResponse.model_validate(a) for a in recent_act_models]

        return DashboardStatsResponse(
            total_files=total_files,
            total_folders=total_folders,
            storage_used_bytes=user.storage_used_bytes,
            storage_quota_bytes=user.storage_quota_bytes,
            shared_files_count=shared_files_count,
            starred_files_count=starred_files_count,
            trash_files_count=trash_files_count,
            file_type_distribution=file_type_distribution,
            recent_files=recent_files,
            recent_activities=recent_activities,
        )

    @staticmethod
    def get_storage_usage(user: User) -> StorageUsageResponse:
        quota = user.storage_quota_bytes
        used = user.storage_used_bytes
        avail = max(0, quota - used)
        pct = round((used / quota * 100), 2) if quota > 0 else 100.0
        return StorageUsageResponse(
            quota_bytes=quota,
            used_bytes=used,
            available_bytes=avail,
            used_percentage=pct,
        )
