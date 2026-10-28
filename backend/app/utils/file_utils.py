"""File handling utilities: validation, categorization, and key generation."""

import mimetypes
import os
import re
import uuid
from datetime import datetime, timezone


SAFE_EXTENSIONS = {
    # Documents
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "csv", "rtf", "odt",
    # Images
    "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff",
    # Audio / Video
    "mp3", "wav", "ogg", "flac", "m4a", "aac", "mp4", "webm", "mkv", "avi", "mov",
    # Archives
    "zip", "tar", "gz", "7z", "rar", "bz2",
    # Code & Data
    "json", "xml", "yaml", "yml", "py", "js", "ts", "tsx", "jsx", "html", "css", "sql", "sh", "log",
}

PREVIEWABLE_EXTENSIONS = {
    "jpg", "jpeg", "png", "gif", "webp", "svg",
    "pdf",
    "txt", "md", "csv", "json", "xml", "yaml", "yml", "log",
    "py", "js", "ts", "tsx", "jsx", "html", "css", "sql", "sh",
}

CATEGORY_MAP = {
    "image": {"jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff"},
    "document": {"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "csv", "rtf", "odt"},
    "video": {"mp4", "webm", "mkv", "avi", "mov"},
    "audio": {"mp3", "wav", "ogg", "flac", "m4a", "aac"},
    "archive": {"zip", "tar", "gz", "7z", "rar", "bz2"},
    "code": {"json", "xml", "yaml", "yml", "py", "js", "ts", "tsx", "jsx", "html", "css", "sql", "sh"},
}


def sanitize_filename(filename: str) -> str:
    """Strip path traversal characters and sanitize filename."""
    # Take basename only
    base = os.path.basename(filename.replace("\\", "/"))
    # Remove null bytes and dangerous chars
    cleaned = re.sub(r'[\\/*?:"<>|\x00]', "", base).strip()
    return cleaned if cleaned else f"file_{uuid.uuid4().hex[:8]}"


def get_file_extension(filename: str) -> str:
    """Return lowercase extension without dot."""
    parts = filename.rsplit(".", 1)
    return parts[1].lower() if len(parts) > 1 else ""


def determine_mime_type(filename: str, provided_mime: str | None = None) -> str:
    """Determine MIME type using mimetypes guessing or safe fallback."""
    guessed, _ = mimetypes.guess_type(filename)
    if guessed:
        return guessed
    if provided_mime and "/" in provided_mime:
        return provided_mime
    return "application/octet-stream"


def get_file_category(filename: str, mime_type: str | None = None) -> str:
    """Classify file into category for filtering and UI icons."""
    ext = get_file_extension(filename)
    for category, extensions in CATEGORY_MAP.items():
        if ext in extensions:
            return category
    if mime_type:
        if mime_type.startswith("image/"):
            return "image"
        if mime_type.startswith("video/"):
            return "video"
        if mime_type.startswith("audio/"):
            return "audio"
        if mime_type.startswith("text/"):
            return "document"
    return "other"


def is_previewable(filename: str, mime_type: str | None = None) -> bool:
    """Check if file can be safely previewed in the browser."""
    ext = get_file_extension(filename)
    if ext in PREVIEWABLE_EXTENSIONS:
        return True
    if mime_type:
        if mime_type.startswith("image/") and not mime_type.endswith("svg+xml"):
            return True
        if mime_type.startswith("text/"):
            return True
        if mime_type == "application/pdf":
            return True
    return False


def generate_storage_key(user_id: uuid.UUID, filename: str) -> str:
    """Generate a collision-proof, hierarchical, safe storage key."""
    now = datetime.now(timezone.utc)
    clean_name = sanitize_filename(filename)
    unique_suffix = uuid.uuid4().hex
    return f"users/{user_id}/{now.year}/{now.month:02d}/{unique_suffix}_{clean_name}"
