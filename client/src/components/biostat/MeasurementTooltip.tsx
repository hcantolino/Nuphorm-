import { useState, useRef, useEffect } from "react";
import { Info, X } from "lucide-react";
import { MeasurementMetadata } from "@/data/measurementMetadata";

interface MeasurementTooltipProps {
  measurement: MeasurementMetadata;
  children: React.ReactNode;
}

export default function MeasurementTooltip({
  measurement,
  children,
}: MeasurementTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current) return;

    // Calculate position
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    let top = triggerRect.top - tooltipRect.height - 12;
    let left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;

    // Adjust if tooltip goes off-screen
    if (top < 10) {
      top = triggerRect.bottom + 12;
    }

    if (left < 10) {
      left = 10;
    } else if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }

    setPosition({ top, left });
  }, [isVisible]);

  const handleMouseLeave = () => {
    // Delay closing tooltip to allow click to register
    setTimeout(() => setIsVisible(false), 50);
  };

  return (
    <>
      <div
        ref={triggerRef}
        className="w-full"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={handleMouseLeave}
      >
        {/* Render children directly without wrapper */}
        {children}
        {/* BEFORE: text-blue-400 */}
        <Info className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2" />
      </div>

      {/* Tooltip Popover */}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-sm p-4 animate-in fade-in duration-200 pointer-events-auto"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={handleMouseLeave}
        >
          {/* Close Button */}
          {/* BEFORE: text-gray-400 hover:text-gray-600 */}
          <button
            onClick={() => setIsVisible(false)}
            className="absolute top-2 right-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Title */}
          <div className="mb-3 pr-6">
            {/* BEFORE: text-gray-900 */}
            <h3 className="text-sm font-bold text-white">{measurement.name}</h3>
            {/* BEFORE: text-blue-600 */}
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {measurement.category}
            </p>
          </div>

          {/* Description */}
          <div className="mb-3">
            {/* BEFORE: text-gray-700 */}
            <p className="text-xs text-slate-300 leading-relaxed">
              {measurement.description}
            </p>
          </div>

          {/* Formula */}
          {/* BEFORE: bg-gray-50 border-gray-200, label text-gray-600, code text-gray-800 */}
          <div className="mb-3 p-2 bg-slate-700 rounded border border-slate-600">
            <p className="text-xs font-semibold text-slate-400 mb-1">Formula:</p>
            <code className="text-xs text-slate-100 font-mono break-words">
              {measurement.formula}
            </code>
          </div>

          {/* Use Cases */}
          <div className="mb-3">
            {/* BEFORE: text-gray-600 */}
            <p className="text-xs font-semibold text-slate-400 mb-1.5">Use Cases:</p>
            <ul className="space-y-1">
              {measurement.useCases.map((useCase, idx) => (
                // BEFORE: text-gray-700 with text-blue-500 bullet
                <li key={idx} className="text-xs text-slate-300 flex gap-2">
                  <span className="text-slate-400 font-bold">•</span>
                  <span>{useCase}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Interpretation */}
          {/* BEFORE: bg-blue-50 border-blue-200, text-blue-900 / text-blue-800 */}
          <div className="mb-3 p-2 bg-slate-700 rounded border border-slate-600">
            <p className="text-xs font-semibold text-slate-300 mb-1">Interpretation:</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {measurement.interpretation}
            </p>
          </div>

          {/* Example */}
          {measurement.example && (
            // BEFORE: bg-green-50 border-green-200, text-green-900 / text-green-800
            <div className="p-2 bg-slate-700 rounded border border-slate-600">
              <p className="text-xs font-semibold text-slate-300 mb-1">Example:</p>
              <p className="text-xs text-slate-300">{measurement.example}</p>
            </div>
          )}

          {/* Arrow Indicator */}
          {/* BEFORE: bg-white border-gray-200 */}
          <div className="absolute w-2 h-2 bg-slate-800 border-r border-b border-slate-700 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2" />
        </div>
      )}
    </>
  );
}
