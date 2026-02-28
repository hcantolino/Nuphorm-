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
  // "subscription" removed from top-level — nested under "Profile" below
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
    // Auto-expand if subscription is active
    activeItem === "subscription"
  );
  const { isCollapsed, setIsCollapsed } = useSidebarContext();
  const { user } = useAuth();
  const [location] = useLocation();

  const handleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleItemClick = (itemId: string) => {
    onItemClick?.(itemId);
    setIsOpen(false);
  };

  const sidebarWidth = isCollapsed ? "w-20" : "w-64";

  // Shared link class builder
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
          <div
            className={`flex items-center ${
              isCollapsed ? "justify-center w-full" : "gap-3"
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0693e3] to-[#0574c1] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <h1 className="text-white font-semibold text-sm">NuPhorm</h1>
                <p className="text-[#8a9aaa] text-xs">Platform</p>
              </div>
            )}
          </div>
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
                        onClick={() => handleItemClick(item.id)}
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
                            onClick={() => handleItemClick("subscription")}
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
                    onClick={() => handleItemClick(item.id)}
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

          {/* Collapse toggle — sits immediately below the last nav item */}
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
                          onClick={() => handleItemClick(item.id)}
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
          <p className="text-[#6a7a8a] text-xs text-center">© 2026 NuPhorm</p>
        </div>
      </aside>
    </>
  );
}
