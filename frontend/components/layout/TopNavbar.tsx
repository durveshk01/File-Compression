"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Bell,
  Sun,
  Moon,
  Upload,
  FolderPlus,
  User as UserIcon,
  LogOut,
  Settings,
  Check,
  CheckCheck,
  X,
  Menu,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { api } from "@/lib/api";
import { NotificationItem } from "@/types";
import { formatDate } from "@/lib/utils";

interface TopNavbarProps {
  onOpenMobileMenu?: () => void;
  onOpenUploadModal?: () => void;
  onOpenNewFolderModal?: () => void;
}

export function TopNavbar({
  onOpenMobileMenu,
  onOpenUploadModal,
  onOpenNewFolderModal,
}: TopNavbarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const loadNotifications = () => {
    api.getNotifications()
      .then(setNotifications)
      .catch(() => {});
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/files?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    loadNotifications();
  };

  const markSingleRead = async (id: string) => {
    await api.markNotificationRead(id);
    loadNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left: Mobile hamburger & search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-accent"
        >
          <Menu className="w-5 h-5" />
        </button>

        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search files, folders, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-accent/40 border border-border text-foreground text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-muted-foreground"
          />
        </form>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Upload Button */}
        {onOpenUploadModal && (
          <button
            onClick={onOpenUploadModal}
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-card" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-3.5 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-indigo-600 hover:underline font-medium flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 flex items-start gap-3 transition-colors ${
                        n.is_read ? "opacity-75" : "bg-indigo-50/40 dark:bg-indigo-950/20"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <span className="text-[10px] text-muted-foreground mt-1 block">
                          {formatDate(n.created_at)}
                        </span>
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={() => markSingleRead(n.id)}
                          className="text-muted-foreground hover:text-indigo-600 p-1"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent text-foreground transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-semibold text-xs flex items-center justify-center">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="hidden md:inline-block text-xs font-medium max-w-[120px] truncate">
              {user?.full_name || "User"}
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-50 py-1.5 text-xs">
              <div className="px-3.5 py-2 border-b border-border">
                <p className="font-semibold text-foreground truncate">{user?.full_name}</p>
                <p className="text-muted-foreground truncate">{user?.email}</p>
              </div>

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  router.push("/settings/profile");
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-accent text-foreground flex items-center gap-2"
              >
                <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                Profile Details
              </button>

              <button
                onClick={() => {
                  setShowUserMenu(false);
                  router.push("/settings/security");
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-accent text-foreground flex items-center gap-2"
              >
                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                Security & Password
              </button>

              <div className="border-t border-border mt-1 pt-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-medium flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
