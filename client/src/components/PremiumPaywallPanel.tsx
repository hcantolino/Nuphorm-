import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useLocation } from "wouter";

interface PremiumPaywallPanelProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onDismiss?: () => void;
  onUpgrade?: () => void;
}

export default function PremiumPaywallPanel({
  title = "You need a Premium membership",
  message = "In order to access this feature, please consider upgrading to a Premium plan. You can check it out here:",
  actionLabel = "UNLOCK ACCESS FOR $0",
  onDismiss,
  onUpgrade,
}: PremiumPaywallPanelProps) {
  const [, setLocation] = useLocation();

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      setLocation("/subscription");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-8 relative">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Content */}
        <div className="text-center space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              You need a <span className="text-blue-600">Premium</span> membership to access this feature
            </h2>
            <p className="text-gray-600 text-base">{message}</p>
          </div>

          {/* Premium Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Pricing Info */}
          <div className="bg-blue-50 rounded-lg p-6 space-y-2">
            <p className="text-gray-700 font-semibold">Premium Plan</p>
            <p className="text-gray-600 text-sm">
              Unlock full access to all premium features for only <span className="font-bold">$0</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center pt-4">
            <Button
              variant="outline"
              onClick={onDismiss}
              className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-2 font-semibold"
            >
              DISMISS
            </Button>
            <Button
              onClick={handleUpgrade}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 font-semibold"
            >
              {actionLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
