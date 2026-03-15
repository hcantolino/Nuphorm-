import { Toaster } from "@/components/ui/sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SidebarProvider, useSidebarContext } from "./contexts/SidebarContext";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import { useState } from "react";
import SavedFiles from "./pages/SavedFiles";
import SavedTechnicalFiles from "./pages/SavedTechnicalFiles";
import Biostatistics from "./pages/Biostatistics";
import DataUploaded from "./pages/DataUploaded";
import Regulatory from "./pages/Regulatory";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import DemoCreate from "./pages/DemoCreate";
import Subscription from "./pages/Subscription";
import Profile from "./pages/Profile";
import ProfileSettings from "./pages/ProfileSettings";
import { useAuth } from "@/_core/hooks/useAuth";
import LandingPage from "./pages/LandingPage";
import PremiumBanner from "./components/PremiumBanner";
import AdminFeedback from "./pages/AdminFeedback";
import SessionErrorHandler from "./components/SessionErrorHandler";
import SessionWarningBanner from "./components/SessionWarningBanner";
import SessionActivityDashboard from "./components/SessionActivityDashboard";
import OfflineDetectionBanner from "./components/OfflineDetectionBanner";

console.log("App.tsx module loaded");

function Router() {
  console.log("Router() rendering");
  const [activeItem, setActiveItem] = useState("dashboard");
  const { user, isAuthenticated, loading } = useAuth();
  const { isCollapsed } = useSidebarContext();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Switch>
        <Route path={"/login"} component={Login} />
        <Route path={"/signup"} component={SignUp} />
        <Route path={"/subscription"} component={Subscription} />
        <Route path={"/profile/account"} component={Profile} />
        <Route>
          {() => (
            <div className="h-screen overflow-hidden flex flex-col">
              <div className="flex-shrink-0">
                <OfflineDetectionBanner />
                <SessionActivityDashboard />
                <SessionWarningBanner />
                <PremiumBanner isVisible={isAuthenticated && user?.subscriptionStatus !== 'active'} />
                <SessionErrorHandler errorType={null} />
              </div>
              <div className="flex flex-1 min-h-0 overflow-hidden">
                <Sidebar
                  activeItem={activeItem}
                  onItemClick={setActiveItem}
                />
                <main
                  className={`flex-1 min-h-0 overflow-y-auto w-full transition-all duration-300 ease-in-out hidden lg:block`}
                  style={{
                    marginLeft: isCollapsed ? "80px" : "256px",
                  }}
                >
                  <Switch>
                    <Route path={"/"} component={LandingPage} />
                    <Route path={"/dashboard"} component={Dashboard} />
                    <Route path={"/regulatory"} component={Regulatory} />
                    <Route path={"/saved-files"} component={SavedFiles} />
                    <Route
                      path={"/saved-technical-files"}
                      component={SavedTechnicalFiles}
                    />
                    <Route path={"/biostatistics"} component={Biostatistics} />
                    <Route path={"/demo-create"} component={DemoCreate} />
                    <Route path={"/data-uploaded"} component={DataUploaded} />
                    <Route path={"/profile"} component={ProfileSettings} />
                    <Route path={"/admin-feedback"} component={AdminFeedback} />
                    <Route path={"/404"} component={NotFound} />
                    <Route component={NotFound} />
                  </Switch>
                </main>
              </div>
            </div>

          )}
        </Route>
      </Switch>

    </>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <SidebarProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </SidebarProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
