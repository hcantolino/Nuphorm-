import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function Subscription() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: subscription, isLoading } = trpc.subscription.getStatus.useQuery();
  const createCheckout = trpc.subscription.createCheckout.useMutation();
  const cancel = trpc.subscription.cancel.useMutation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, loading, setLocation]);

  const handleUpgrade = async () => {
    try {
      const result = await createCheckout.mutateAsync({
        returnUrl: window.location.origin + "/dashboard",
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      toast.error("Failed to create checkout session");
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your subscription?")) return;

    try {
      await cancel.mutateAsync();
      toast.success("Subscription cancelled");
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

  if (!isAuthenticated) {
    return null;
  }

  const isTrialAvailable = subscription?.trialUsedCount === 0;
  const isActive = subscription?.subscriptionStatus === "active";
  const isCanceled = subscription?.subscriptionStatus === "canceled";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 className="text-3xl font-bold mb-2">Subscription</h1>
        <p className="text-gray-600">Manage your MedReg Platform subscription</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Trial Card */}
        <Card className="p-6 border-2 border-gray-200 hover:border-gray-300 transition">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold">Free Trial</h3>
              <p className="text-sm text-gray-600 mt-1">Get started for free</p>
            </div>
            {isTrialAvailable && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                Available
              </span>
            )}
            {!isTrialAvailable && (
              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                Used
              </span>
            )}
          </div>

          <p className="text-4xl font-bold mb-4">
            $0<span className="text-lg text-gray-600">/month</span>
          </p>

          <ul className="space-y-2 mb-6 text-sm">
            <li className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              1 free generation
            </li>
            <li className="flex items-center text-gray-500">
              <span className="text-gray-400 mr-2">✗</span>
              Limited features
            </li>
            <li className="flex items-center text-gray-500">
              <span className="text-gray-400 mr-2">✗</span>
              No support
            </li>
          </ul>

          <p className="text-xs text-gray-600">
            Trial uses: <strong>{subscription?.trialUsedCount || 0}/1</strong>
          </p>
        </Card>

        {/* Premium Card */}
        <Card className="p-6 border-2 border-blue-500 bg-blue-50 shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold">Premium</h3>
              <p className="text-sm text-gray-600 mt-1">Unlimited access</p>
            </div>
            {isActive && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                Active
              </span>
            )}
            {isCanceled && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                Canceled
              </span>
            )}
          </div>

          <p className="text-4xl font-bold mb-4">
            $30<span className="text-lg text-gray-600">/month</span>
          </p>

          <ul className="space-y-2 mb-6 text-sm">
            <li className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              Unlimited generations
            </li>
            <li className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              All features
            </li>
            <li className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              Priority support
            </li>
          </ul>

          {isActive ? (
            <div className="space-y-3">
              <p className="text-sm text-green-700 font-medium">
                ✓ Your subscription is active
              </p>
              {subscription?.subscriptionEndDate && (
                <p className="text-xs text-gray-600">
                  Renews on{" "}
                  {new Date(subscription.subscriptionEndDate).toLocaleDateString()}
                </p>
              )}
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={cancel.isPending}
                className="w-full"
              >
                {cancel.isPending ? "Canceling..." : "Cancel Subscription"}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleUpgrade}
              disabled={createCheckout.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11"
            >
              {createCheckout.isPending ? "Processing..." : "Upgrade Now"}
            </Button>
          )}
        </Card>
      </div>

      {/* Billing History */}
      <Card className="mt-8 p-6">
        <h2 className="text-lg font-bold mb-4">Billing & History</h2>
        <p className="text-gray-600 text-sm">
          Invoices and billing information will appear here. For questions, contact{" "}
          <a href="mailto:support@medreg.com" className="text-blue-600 hover:underline">
            support@medreg.com
          </a>
        </p>
      </Card>
    </div>
  );
}
