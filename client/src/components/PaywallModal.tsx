import { X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export default function PaywallModal({
  isOpen,
  onClose,
  title = 'Free Trial Used',
  message = 'You\'ve used your free analysis. Upgrade to Professional to continue.',
}: PaywallModalProps) {
  const [, setLocation] = useLocation();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    onClose();
    setLocation('/subscription');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex justify-center mb-4">
          <div className="bg-blue-100 p-3 rounded-full">
            <Zap className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">{title}</h2>
        <p className="text-center text-gray-600 mb-8">{message}</p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-gray-900 mb-3">Professional Plan Includes:</h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-gray-700">
              <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✓</span>
              Unlimited biostatistical analyses
            </li>
            <li className="flex items-center gap-2 text-gray-700">
              <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✓</span>
              Advanced AI insights
            </li>
            <li className="flex items-center gap-2 text-gray-700">
              <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✓</span>
              Priority support
            </li>
            <li className="flex items-center gap-2 text-gray-700">
              <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">✓</span>
              Report templates
            </li>
          </ul>
        </div>

        <div className="text-center mb-6">
          <p className="text-3xl font-bold text-gray-900">$30<span className="text-lg text-gray-600">/month</span></p>
          <p className="text-sm text-gray-600">or $300/year (save 17%)</p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleUpgrade}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 font-semibold"
          >
            Upgrade to Professional
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full h-11"
          >
            Maybe Later
          </Button>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          Cancel anytime. No hidden fees.
        </p>
      </Card>
    </div>
  );
}
