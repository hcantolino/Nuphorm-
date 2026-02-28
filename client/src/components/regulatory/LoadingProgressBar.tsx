import { useEffect, useState } from 'react';

interface LoadingProgressBarProps {
  isVisible: boolean;
  onComplete?: () => void;
}

export function LoadingProgressBar({ isVisible, onComplete }: LoadingProgressBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      return;
    }

    // Start progress immediately
    setProgress(10);

    // Simulate progress with variable increments
    const intervals: NodeJS.Timeout[] = [];
    
    // Fast initial progress (0-30%)
    intervals.push(
      setTimeout(() => setProgress(30), 300)
    );

    // Moderate progress (30-60%)
    intervals.push(
      setTimeout(() => setProgress(60), 1200)
    );

    // Slower progress (60-85%)
    intervals.push(
      setTimeout(() => setProgress(85), 2500)
    );

    // Near completion (85-95%)
    intervals.push(
      setTimeout(() => setProgress(95), 4000)
    );

    // Completion
    intervals.push(
      setTimeout(() => {
        setProgress(100);
        onComplete?.();
      }, 5500)
    );

    return () => {
      intervals.forEach(interval => clearTimeout(interval));
    };
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        {/* Loading spinner */}
        <div className="flex justify-center mb-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div 
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-blue-500 animate-spin"
              style={{
                animation: 'spin 1s linear infinite'
              }}
            ></div>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
          Generating Document
        </h3>
        
        {/* Description */}
        <p className="text-sm text-center text-gray-600 mb-6">
          Processing your regulatory document with AI...
        </p>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Progress text */}
        <p className="text-xs text-center text-gray-500">
          {progress}% Complete
        </p>

        {/* Status messages */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${progress >= 10 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className="text-xs text-gray-600">Analyzing references</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${progress >= 40 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className="text-xs text-gray-600">Generating content</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${progress >= 70 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className="text-xs text-gray-600">Adding annotations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${progress >= 95 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className="text-xs text-gray-600">Finalizing document</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
