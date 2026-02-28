import React, { Suspense, lazy, useState, useCallback } from 'react';
import { Router, Route, Switch } from 'wouter';
import { Toaster } from 'sonner';
import { NuphormProvider } from '@/contexts/NuphormContext';
import MainNavBar from '@/components/MainNavBar';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Lazy load pages
const DocumentCreator = lazy(() => import('@/pages/DocumentCreator'));
const Home = lazy(() => import('@/pages/Home'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-slate-600">Loading...</p>
    </div>
  </div>
);

/**
 * Main Nuphorm Application
 * Complete document creator with navigation, state management, and routing
 */
function NuphormAppContent() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  const handleLogout = useCallback(() => {
    // TODO: Implement logout logic
    console.log('Logout clicked');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Main Navigation */}
      <MainNavBar onLogout={handleLogout} userName="Dr. Smith" />

      {/* Router */}
      <Router>
        <Switch>
          {/* Document Creator - Main Page */}
          <Route path="/creator">
            {() => (
              <div className="ml-16 flex flex-col h-screen">
                <Suspense fallback={<PageLoader />}>
                  <DocumentCreator />
                </Suspense>
              </div>
            )}
          </Route>

          {/* Home Page */}
          <Route path="/">
            {() => (
              <div className="ml-16 flex flex-col h-screen">
                <Suspense fallback={<PageLoader />}>
                  <Home />
                </Suspense>
              </div>
            )}
          </Route>

          {/* Repository Uploads */}
          <Route path="/uploads">
            {() => (
              <div className="ml-16 p-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-4">Repository Uploads</h1>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-slate-600">Upload and manage your source documents here.</p>
                </div>
              </div>
            )}
          </Route>

          {/* Projects */}
          <Route path="/projects">
            {() => (
              <div className="ml-16 p-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-4">Projects</h1>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-slate-600">Manage your regulatory document projects.</p>
                </div>
              </div>
            )}
          </Route>

          {/* Account */}
          <Route path="/account">
            {() => (
              <div className="ml-16 p-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-4">Account Settings</h1>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-slate-600">Manage your account preferences and settings.</p>
                </div>
              </div>
            )}
          </Route>

          {/* 404 */}
          <Route>
            {() => (
              <div className="ml-16">
                <Suspense fallback={<PageLoader />}>
                  <NotFound />
                </Suspense>
              </div>
            )}
          </Route>
        </Switch>
      </Router>

      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        theme="light"
        richColors
        closeButton
        expand
      />
    </div>
  );
}

/**
 * Root App Component with Providers
 */
export default function NuphormApp() {
  return (
    <ThemeProvider defaultTheme="light">
      <NuphormProvider>
        <NuphormAppContent />
      </NuphormProvider>
    </ThemeProvider>
  );
}
