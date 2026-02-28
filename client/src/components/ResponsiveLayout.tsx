import React, { Suspense, useState, useCallback, useMemo } from 'react';
import { Menu, X } from 'lucide-react';

interface ResponsiveLayoutProps {
  mainNav: React.ReactNode;
  sidebar: React.ReactNode;
  content: React.ReactNode;
  bottomBar: React.ReactNode;
  sidebarExpanded?: boolean;
  onSidebarToggle?: (expanded: boolean) => void;
}

/**
 * Responsive layout wrapper with mobile support
 * Handles sidebar collapse, mobile menu, and lazy loading
 */
export default function ResponsiveLayout({
  mainNav,
  sidebar,
  content,
  bottomBar,
  sidebarExpanded = true,
  onSidebarToggle,
}: ResponsiveLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resize
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSidebarToggle = useCallback(() => {
    onSidebarToggle?.(!sidebarExpanded);
  }, [sidebarExpanded, onSidebarToggle]);

  const handleMobileMenuToggle = useCallback(() => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  }, [isMobileMenuOpen]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Main Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        {mainNav}
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 pt-0 overflow-hidden">
        {/* Mobile Menu Button */}
        {isMobile && (
          <button
            onClick={handleMobileMenuToggle}
            className="fixed top-4 left-4 z-40 md:hidden p-2 bg-white rounded-lg shadow-md"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-slate-900" />
            ) : (
              <Menu className="w-6 h-6 text-slate-900" />
            )}
          </button>
        )}

        {/* Sidebar - Hidden on mobile unless menu is open */}
        {(!isMobile || isMobileMenuOpen) && (
          <div
            className={`fixed md:relative left-0 top-0 bottom-0 z-30 bg-slate-900 border-r border-slate-700 transition-all duration-300 ${
              sidebarExpanded ? 'w-64' : 'w-20'
            } ${isMobile ? 'w-64' : ''}`}
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="animate-pulse text-slate-400">Loading...</div>
                </div>
              }
            >
              {sidebar}
            </Suspense>
          </div>
        )}

        {/* Main Content */}
        <div
          className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
            isMobile && isMobileMenuOpen ? 'ml-64' : ''
          }`}
        >
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-slate-600">Loading content...</p>
                </div>
              </div>
            }
          >
            {content}
          </Suspense>
        </div>

        {/* Overlay for mobile menu */}
        {isMobile && isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <Suspense fallback={<div className="h-32 bg-slate-100" />}>
          {bottomBar}
        </Suspense>
      </div>
    </div>
  );
}

/**
 * Lazy loading wrapper for heavy components
 */
export function LazyComponent({
  component: Component,
  fallback = <LoadingPlaceholder />,
}: {
  component: React.ComponentType<any>;
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <Component />
    </Suspense>
  );
}

/**
 * Loading placeholder component
 */
function LoadingPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-blue-200 rounded-lg mx-auto mb-4" />
          <div className="w-32 h-4 bg-slate-200 rounded mx-auto mb-2" />
          <div className="w-24 h-3 bg-slate-200 rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}
