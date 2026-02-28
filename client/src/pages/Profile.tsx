import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Mail, User, Calendar, CheckCircle, AlertCircle, BarChart3, ArrowLeft } from "lucide-react";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export default function Profile() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"overview" | "analytics">("overview");
  const { data: subscription, isLoading } = trpc.subscription.getStatus.useQuery();
  const cancel = trpc.subscription.cancel.useMutation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, loading, setLocation]);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
    setLocation("/login");
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You'll lose access after the current billing period ends.")) {
      return;
    }

    try {
      await cancel.mutateAsync();
      toast.success("Subscription cancelled. You have access until the end of your billing period.");
    } catch (error) {
      toast.error("Failed to cancel subscription");
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const isTrialAvailable = subscription?.trialUsedCount === 0;
  const isActive = subscription?.subscriptionStatus === "active";
  const isCanceled = subscription?.subscriptionStatus === "canceled";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-4xl font-bold mb-2">Account Settings</h1>
          <p className="text-gray-600">Manage your profile, subscription, and analytics</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Overview
            </div>
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === "analytics"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </div>
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Profile Section */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <User className="w-6 h-6" />
                  Profile Information
                </h2>
                <Button variant="outline" onClick={handleLogout}>
                  Logout
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <p className="text-lg text-gray-900">{user.name || "Not provided"}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <p className="text-lg text-gray-900">{user.email || "Not provided"}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Type
                    </label>
                    <p className="text-lg text-gray-900 capitalize">{user.role || "user"}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Member Since
                    </label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <p className="text-lg text-gray-900">
                        {user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleDateString() : "Unknown"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Subscription Section */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
                <CreditCard className="w-6 h-6" />
                Subscription & Billing
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Trial Status */}
                <Card className="p-4 border-2 border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold">Free Trial</h3>
                    {isTrialAvailable ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                        Available
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                        Used
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">1 free generation included</p>
                  <p className="text-sm font-medium">
                    Used: <strong>{subscription?.trialUsedCount || 0}/1</strong>
                  </p>
                </Card>

                {/* Subscription Status */}
                <Card className="p-4 border-2 border-blue-200 bg-blue-50">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold">Premium Subscription</h3>
                    {isActive ? (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </div>
                    ) : isCanceled ? (
                      <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">
                        <AlertCircle className="w-3 h-3" />
                        Canceled
                      </div>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">$30/month - Unlimited generations</p>
                  {isActive && subscription?.subscriptionEndDate && (
                    <p className="text-sm text-gray-700">
                      Renews: <strong>{new Date(subscription.subscriptionEndDate).toLocaleDateString()}</strong>
                    </p>
                  )}
                  {isCanceled && subscription?.subscriptionEndDate && (
                    <p className="text-sm text-gray-700">
                      Access until: <strong>{new Date(subscription.subscriptionEndDate).toLocaleDateString()}</strong>
                    </p>
                  )}
                </Card>
              </div>

              {/* Subscription Actions */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                {isActive ? (
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleCancelSubscription} disabled={cancel.isPending}>
                      {cancel.isPending ? "Canceling..." : "Cancel Subscription"}
                    </Button>
                    <p className="text-sm text-gray-600 flex items-center">
                      Your subscription will remain active until the end of your billing period.
                    </p>
                  </div>
                ) : !isActive ? (
                  <Button
                    onClick={() => window.location.href = "/subscription"}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Upgrade to Premium
                  </Button>
                ) : null}
              </div>
            </Card>

            {/* Payment History */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-6">Payment History</h2>

              {isActive ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">Premium Subscription</p>
                        <p className="text-sm text-gray-600">Monthly recurring charge</p>
                      </div>
                      <p className="font-semibold">$30.00</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Next billing date: {subscription?.subscriptionEndDate ? new Date(subscription.subscriptionEndDate).toLocaleDateString() : "Unknown"}
                    </p>
                  </div>

                  <div className="text-center pt-4">
                    <p className="text-sm text-gray-600">
                      For detailed invoices and receipts, visit your{" "}
                      <a href="https://dashboard.stripe.com/invoices" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Stripe dashboard
                      </a>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No payment history yet</p>
                  <Button
                    onClick={() => window.location.href = "/subscription"}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    View Subscription Plans
                  </Button>
                </div>
              )}
            </Card>

            {/* Support Section */}
            <Card className="p-6 bg-blue-50 border-blue-200">
              <h3 className="font-semibold mb-2">Need Help?</h3>
              <p className="text-sm text-gray-700 mb-4">
                If you have any questions about your subscription or account, please contact our support team.
              </p>
              <a
                href="mailto:support@medreg.com"
                className="text-blue-600 hover:underline text-sm font-medium"
              >
                Contact Support →
              </a>
            </Card>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div>
            {isActive || subscription?.subscriptionStatus === "trial" ? (
              <AnalyticsDashboard userId={user.id} />
            ) : (
              <Card className="p-12 text-center">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold mb-2">Analytics Available for Premium Users</h3>
                <p className="text-gray-600 mb-6">
                  Upgrade to premium to track your generation history, storage usage, and performance metrics.
                </p>
                <Button
                  onClick={() => window.location.href = "/subscription"}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Upgrade Now
                </Button>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
