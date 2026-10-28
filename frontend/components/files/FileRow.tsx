"use client";

import React from "react";
import {
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Code,
  File,
  Star,
  Download,
  Share2,
  Trash2,
  History,
  Eye,
  MoreVertical,
} from "lucide-react";
import { FileItem } from "@/types";
import { formatBytes, formatDate, getFileCategory } from "@/lib/utils";
import { api } from "@/lib/api";

interface FileRowProps {
  file: FileItem;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onPreview: () => void;
  onShare: () => void;
  onVersions: () => void;
  onDetails: () => void;
  onRefresh: () => void;
}

export function FileRow({
  file,
  isSelected,
  onSelect,
  onPreview,
  onShare,
  onVersions,
  onDetails,
  onRefresh,
}: FileRowProps) {
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const category = getFileCategory(file.original_filename, file.mime_type);

  const getIcon = () => {
    switch (category) {
      case "image":
        return <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />;
      case "video":
        return <Video className="w-4 h-4 text-purple-500 shrink-0" />;
      case "audio":
        return <Music className="w-4 h-4 text-pink-500 shrink-0" />;
      case "archive":
        return <Archive className="w-4 h-4 text-amber-500 shrink-0" />;
      case "code":
        return <Code className="w-4 h-4 text-emerald-500 shrink-0" />;
      case "document":
        return <FileText className="w-4 h-4 text-indigo-500 shrink-0" />;
      default:
        return <File className="w-4 h-4 text-slate-500 shrink-0" />;
    }
  };

  const handleToggleStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await api.toggleStar(file.id);
    onRefresh();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteFile(file.id);
    onRefresh();
  };

  return (
    <tr
      onClick={onSelect}
      onDoubleClick={onPreview}
      className={`border-b border-border transition-colors cursor-pointer text-xs select-none ${
        isSelected
          ? "bg-indigo-50/40 dark:bg-indigo-950/30"
          : "hover:bg-accent/40"
      }`}
    >
      {/* Star */}
      <td className="py-3 px-3 w-8">
        <button
          onClick={handleToggleStar}
          className={`p-1 rounded transition-colors ${
            file.is_starred ? "text-amber-500" : "text-muted-foreground/30 hover:text-amber-500"
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${file.is_starred ? "fill-amber-500" : ""}`} />
        </button>
      </td>

      {/* Name with Icon */}
      <td className="py-3 px-3 max-w-[260px]">
        <div className="flex items-center gap-2.5">
          {getIcon()}
          <span className="font-medium text-foreground truncate" title={file.original_filename}>
            {file.original_filename}
          </span>
        </div>
      </td>

      {/* Category */}
      <td className="py-3 px-3 text-muted-foreground capitalize hidden sm:table-cell">
        {category}
      </td>

      {/* Size */}
      <td className="py-3 px-3 text-muted-foreground">
        {formatBytes(file.size_bytes)}
      </td>

      {/* Version */}
      <td className="py-3 px-3 text-muted-foreground hidden md:table-cell">
        v{file.current_version}
      </td>

      {/* Date */}
      <td className="py-3 px-3 text-muted-foreground hidden lg:table-cell">
        {formatDate(file.updated_at || file.created_at)}
      </td>

      {/* Actions */}
      <td className="py-3 px-3 text-right">
        <div className="relative inline-block" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1 w-44 bg-card border border-border rounded-xl shadow-xl z-20 py-1 text-xs text-left">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onPreview();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-accent text-foreground flex items-center gap-2"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
              <a
                href={api.getFileDownloadUrl(file.id)}
                download={file.original_filename}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-left px-3 py-1.5 hover:bg-accent text-foreground flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onShare();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-accent text-foreground flex items-center gap-2"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onVersions();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-accent text-foreground flex items-center gap-2"
              >
                <History className="w-3.5 h-3.5" />
                Version History
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onDetails();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-accent text-foreground flex items-center gap-2"
              >
                <FileText className="w-3.5 h-3.5" />
                File Details
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={handleDelete}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center gap-2 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Move to Trash
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
