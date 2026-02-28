import { useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/**
 * Hook to guard generation endpoints with trial/subscription checks
 * Usage:
 *   const { canGenerate, checkAndUseGeneration } = useTrialGuard();
 *   
 *   if (canGenerate()) {
 *     await checkAndUseGeneration();
 *     // proceed with generation
 *   }
 */
export function useTrialGuard() {
  const [, setLocation] = useLocation();
  const { data: subscription, isLoading } = trpc.subscription.getStatus.useQuery();
  const useTrial = trpc.subscription.useTrial.useMutation();

  const canGenerate = useCallback(() => {
    if (isLoading) {
      toast.error("Loading subscription status...");
      return false;
    }

    if (!subscription) {
      toast.error("Unable to verify subscription");
      return false;
    }

    // Check if trial is already used and no active subscription
    if (
      subscription.subscriptionStatus === "trial" &&
      subscription.trialUsedCount >= 1
    ) {
      toast.error("Free trial used. Please upgrade to continue generating.");
      setLocation("/subscription");
      return false;
    }

    // Check if subscription is canceled or expired
    if (
      subscription.subscriptionStatus === "canceled" ||
      subscription.subscriptionStatus === "expired"
    ) {
      toast.error("Your subscription is not active. Please renew to continue.");
      setLocation("/subscription");
      return false;
    }

    return true;
  }, [subscription, isLoading, setLocation]);

  const checkAndUseGeneration = useCallback(async () => {
    if (!subscription) {
      throw new Error("Subscription not loaded");
    }

    // If on trial, use it
    if (subscription.subscriptionStatus === "trial") {
      try {
        await useTrial.mutateAsync();
        toast.success("Using your free trial generation");
      } catch (error: any) {
        throw new Error(error.message || "Failed to use trial");
      }
    }

    // If active subscription, proceed
    if (subscription.subscriptionStatus === "active") {
      toast.success("Generating chart...");
      return;
    }

    throw new Error("Invalid subscription status");
  }, [subscription, useTrial]);

  return {
    canGenerate,
    checkAndUseGeneration,
    subscription,
    isLoading,
  };
}
