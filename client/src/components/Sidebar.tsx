import React, { useState } from "react";
import {
  Menu,
  X,
  FileText,
  Save,
  BarChart3,
  Database,
  User,
  CreditCard,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogIn,
  LogOut,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSidebarContext } from "@/contexts/SidebarContext";

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

const sidebarItems: SidebarItem[] = [
  {
    id: "regulatory",
    label: "Create a Regulatory Document",
    icon: <FileText className="w-5 h-5" />,
    href: "/regulatory",
  },
  {
    id: "biostatistics",
    label: "Create Biostatistics",
    icon: <BarChart3 className="w-5 h-5" />,
    href: "/biostatistics",
  },
  {
    id: "saved-technical-files",
    label: "Saved Technical Files",
    icon: <Save className="w-5 h-5" />,
    href: "/saved-technical-files",
  },
  {
    id: "data-uploaded",
    label: "Data Uploaded",
    icon: <Database className="w-5 h-5" />,
    href: "/data-uploaded",
  },
  {
    id: "profile",
    label: "Profile",
    icon: <User className="w-5 h-5" />,
    href: "/profile",
  },
];

const adminItems: SidebarItem[] = [
  {
    id: "admin-feedback",
    label: "Feedback Management",
    icon: <MessageSquare className="w-5 h-5" />,
    href: "/admin/feedback",
  },
];

interface SidebarProps {
  activeItem?: string;
  onItemClick?: (itemId: string) => void;
}

export default function Sidebar({ activeItem, onItemClick }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(
    activeItem === "subscription"
  );
  const { isCollapsed, setIsCollapsed } = useSidebarContext();
  const { user, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleItemClick = (item: SidebarItem) => {
    onItemClick?.(item.id);
    setIsOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const sidebarWidth = isCollapsed ? "w-20" : "w-64";

  const linkClass = (isActive: boolean) => `
    flex items-center gap-3 px-4 py-3 rounded-lg
    transition-all duration-200 ease-in-out
    relative group
    ${
      isActive
        ? "bg-[#2a3a4a] text-white border-l-4 border-[#0693e3]"
        : "text-[#a0b0c0] hover:text-white hover:bg-[#1f2d3d]"
    }
    ${isCollapsed ? "px-3 justify-center" : ""}
  `;

  const iconClass = (isActive: boolean) =>
    `flex-shrink-0 transition-colors duration-200 ${
      isActive ? "text-[#0693e3]" : "text-[#8a9aaa] group-hover:text-[#0693e3]"
    }`;

  // Get first initial for avatar
  const userInitial = user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-gray-700" />
        ) : (
          <Menu className="w-6 h-6 text-gray-700" />
        )}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen bg-gradient-to-b from-[#1a2332] to-[#0f1419]
          border-r border-[#2a3a4a] shadow-xl
          transform transition-all duration-300 ease-in-out z-40
          lg:translate-x-0 flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
          ${sidebarWidth}
        `}
      >
        {/* Logo/Branding Section */}
        <div
          className={`px-6 py-8 border-b border-[#2a3a4a] flex items-center justify-between ${
            isCollapsed ? "px-3" : ""
          }`}
        >
          <Link
            href="/"
            onClick={() => onItemClick?.("home")}
            className={`flex items-center cursor-pointer group transition-all duration-200 ${
              isCollapsed ? "justify-center w-full" : "gap-3"
            }`}
            title="Go to home page"
            aria-label="Nuphorm home"
          >
            <div className="w-10 h-10 rounded-full bg-[#194CFF] flex items-center justify-center flex-shrink-0 group-hover:bg-[#3B82F6] transition-colors duration-200 shadow-md">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <h1 className="text-white font-bold text-[1.05rem] leading-tight group-hover:text-[#93b4ff] transition-colors duration-200">
                  Nuphorm
                </h1>
                <p className="text-[#8a9aaa] text-xs group-hover:text-[#a0b0c0] transition-colors duration-200">
                  Platform
                </p>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          <ul className="space-y-2">
            {sidebarItems.map((item) => {
              const isActive = activeItem === item.id;

              // Profile item — rendered as expandable parent when not collapsed
              if (item.id === "profile") {
                const isProfileActive = activeItem === "profile";
                const isSubscriptionActive = activeItem === "subscription";
                const parentActive = isProfileActive || isSubscriptionActive;

                return (
                  <li key={item.id}>
                    {/* Profile row */}
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        onClick={() => {
                          handleItemClick(item);
                        }}
                        className={`
                          flex-1 flex items-center gap-3 px-4 py-3 rounded-l-lg
                          transition-all duration-200 ease-in-out relative group
                          ${
                            isProfileActive
                              ? "bg-[#2a3a4a] text-white border-l-4 border-[#0693e3]"
                              : "text-[#a0b0c0] hover:text-white hover:bg-[#1f2d3d]"
                          }
                          ${isCollapsed ? "px-3 justify-center rounded-lg" : ""}
                        `}
                        title={isCollapsed ? item.label : undefined}
                      >
                        {isProfileActive && !isCollapsed && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0693e3] rounded-r-full" />
                        )}
                        <span className={iconClass(isProfileActive)}>
                          {item.icon}
                        </span>
                        {!isCollapsed && (
                          <span
                            className={`text-sm font-medium transition-colors duration-200 ${
                              isProfileActive ? "font-semibold" : ""
                            }`}
                          >
                            {item.label}
                          </span>
                        )}
                      </Link>

                      {/* Expand toggle — only in non-collapsed mode */}
                      {!isCollapsed && (
                        <button
                          onClick={() => setProfileExpanded((v) => !v)}
                          className={`
                            px-2 py-3 rounded-r-lg transition-all duration-200
                            ${
                              parentActive
                                ? "bg-[#2a3a4a] text-[#8a9aaa] hover:text-white"
                                : "text-[#6a7a8a] hover:text-white hover:bg-[#1f2d3d]"
                            }
                          `}
                          title={profileExpanded ? "Collapse" : "Expand"}
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              profileExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      )}
                    </div>

                    {/* Subscription sub-item */}
                    {profileExpanded && !isCollapsed && (
                      <ul className="mt-1 ml-4 space-y-1 border-l border-[#2a3a4a] pl-3">
                        <li>
                          <Link
                            href="/subscription"
                            onClick={() => {
                              onItemClick?.("subscription");
                              setIsOpen(false);
                            }}
                            className={`
                              flex items-center gap-3 px-3 py-2 rounded-lg
                              transition-all duration-200 relative group
                              ${
                                isSubscriptionActive
                                  ? "bg-[#2a3a4a] text-white"
                                  : "text-[#8a9aaa] hover:text-white hover:bg-[#1f2d3d]"
                              }
                            `}
                          >
                            <span
                              className={iconClass(isSubscriptionActive)}
                            >
                              <CreditCard className="w-4 h-4" />
                            </span>
                            <span
                              className={`text-xs font-medium ${
                                isSubscriptionActive ? "font-semibold text-white" : ""
                              }`}
                            >
                              Subscription
                            </span>
                          </Link>
                        </li>
                      </ul>
                    )}

                  </li>
                );
              }

              // Standard item
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      handleItemClick(item);
                    }}
                    className={linkClass(isActive)}
                    title={isCollapsed ? item.label : undefined}
                  >
                    {isActive && !isCollapsed && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0693e3] rounded-r-full" />
                    )}
                    <span className={iconClass(isActive)}>{item.icon}</span>
                    {!isCollapsed && (
                      <span
                        className={`text-sm font-medium transition-colors duration-200 ${
                          isActive ? "font-semibold" : ""
                        }`}
                      >
                        {item.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* ── Sign In / User Section ── */}
          <div className="mt-4">
            {isAuthenticated && user ? (
              /* Authenticated: show avatar, email, sign out */
              <div className="space-y-2">
                {!isCollapsed && (
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#194CFF] to-[#0693e3] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{userInitial}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-xs font-medium truncate">{user.name || "User"}</p>
                      <p className="text-[#6a7a8a] text-[10px] truncate">{user.email}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className={`
                    flex items-center gap-3 w-full rounded-lg
                    border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]
                    text-[#f87171] hover:bg-[rgba(239,68,68,0.15)]
                    transition-all duration-200
                    ${isCollapsed ? "px-3 py-3 justify-center" : "px-4 py-2.5"}
                  `}
                  title={isCollapsed ? "Sign Out" : undefined}
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && <span className="text-sm font-medium">Sign Out</span>}
                </button>
              </div>
            ) : (
              /* Not authenticated: show Sign In button */
              <button
                onClick={() => {
                  setLocation("/login");
                  setIsOpen(false);
                }}
                className={`
                  flex items-center gap-3 w-full rounded-lg
                  border border-[rgba(43,125,233,0.3)] bg-[rgba(43,125,233,0.08)]
                  text-[#5aa3f0] hover:bg-[rgba(43,125,233,0.15)]
                  transition-all duration-200
                  ${isCollapsed ? "px-3 py-3 justify-center" : "px-4 py-2.5"}
                `}
                title={isCollapsed ? "Sign In" : undefined}
              >
                <LogIn className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="text-sm font-medium">Sign In</span>}
              </button>
            )}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={handleCollapse}
            className="hidden lg:flex w-full items-center justify-center mt-2 px-3 py-2 rounded-lg text-[#8a9aaa] hover:text-white hover:bg-[#1f2d3d] transition-colors duration-200"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>

          {/* Admin Section */}
          {user?.role === "admin" && (
            <>
              <div
                className={`mt-8 pt-6 border-t border-[#2a3a4a] ${
                  isCollapsed ? "px-0" : ""
                }`}
              >
                {!isCollapsed && (
                  <p className="px-4 text-xs font-semibold text-[#8a9aaa] uppercase tracking-wider mb-3">
                    Admin
                  </p>
                )}
                <ul className="space-y-2">
                  {adminItems.map((item) => {
                    const isActive = activeItem === item.id;
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          onClick={() => {
                            onItemClick?.(item.id);
                            setIsOpen(false);
                          }}
                          className={linkClass(isActive)}
                          title={isCollapsed ? item.label : undefined}
                        >
                          {isActive && !isCollapsed && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0693e3] rounded-r-full" />
                          )}
                          <span className={iconClass(isActive)}>{item.icon}</span>
                          {!isCollapsed && (
                            <span
                              className={`text-sm font-medium transition-colors duration-200 ${
                                isActive ? "font-semibold" : ""
                              }`}
                            >
                              {item.label}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-[#2a3a4a]">
          <p className="text-[#6a7a8a] text-xs text-center">&copy; 2026 NuPhorm</p>
        </div>
      </aside>
    </>
  );
}
