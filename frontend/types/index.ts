export interface User {
  id: string;
  email: string;
  full_name: string;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  is_active: boolean;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface FileItem {
  id: string;
  owner_id: string;
  folder_id: string | null;
  original_filename: string;
  storage_key: string;
  mime_type: string | null;
  size_bytes: number;
  checksum: string | null;
  is_trashed: boolean;
  trashed_at: string | null;
  is_starred: boolean;
  current_version: number;
  created_at: string;
  updated_at: string | null;
  tags?: Tag[];
}

export interface FolderItem {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  is_trashed: boolean;
  trashed_at: string | null;
  created_at: string;
  updated_at: string | null;
  file_count?: number;
  subfolder_count?: number;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface FileVersion {
  id: string;
  file_id: string;
  version_number: number;
  storage_key: string;
  size_bytes: number;
  checksum: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface FileShare {
  id: string;
  file_id: string;
  shared_by: string;
  shared_with: string;
  permission: "viewer" | "editor";
  created_at: string;
  file?: FileItem;
  sharer?: User;
  recipient?: User;
}

export interface ShareLink {
  id: string;
  file_id: string;
  token?: string;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  permission: "view" | "download";
  is_revoked: boolean;
  created_at: string;
  share_url?: string;
}

export interface PublicShareInfo {
  token: string;
  filename: string;
  file_size: number;
  mime_type: string | null;
  permission: string;
  requires_password: boolean;
  is_expired: boolean;
  downloads_remaining: number | null;
  preview_supported: boolean;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  resource_name: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  resource_type: string | null;
  resource_id: string | null;
  created_at: string;
}

export interface FileTypeStat {
  category: string;
  count: number;
  size_bytes: number;
}

export interface DashboardStats {
  total_files: number;
  total_folders: number;
  storage_used_bytes: number;
  storage_quota_bytes: number;
  shared_files_count: number;
  starred_files_count: number;
  trash_files_count: number;
  file_type_distribution: FileTypeStat[];
  recent_files: FileItem[];
  recent_activities: ActivityLog[];
}

export interface StorageUsage {
  quota_bytes: number;
  used_bytes: number;
  available_bytes: number;
  used_percentage: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
