import { X } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';

interface PremiumBannerProps {
  isVisible: boolean;
  onDismiss?: () => void;
}

export default function PremiumBanner({ isVisible, onDismiss }: PremiumBannerProps) {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (!isVisible || dismissed) return null;

  const handleGetAccess = () => {
    setLocation('/subscription');
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 text-white px-4 py-4 w-full">
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-6">
        <div className="flex-1 text-center">
          <p className="font-semibold text-lg">Unlock all benefits</p>
          <p className="text-sm opacity-95">Upgrade to Professional for unlimited analyses and advanced features</p>
        </div>
        
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button
            onClick={handleGetAccess}
            className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-8 py-2 rounded-lg transition-all hover:shadow-lg"
            size="sm"
          >
            Get Access
          </Button>
          <button
            onClick={handleDismiss}
            className="text-white hover:opacity-70 transition p-1 hover:bg-white/10 rounded"
            aria-label="Dismiss banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
