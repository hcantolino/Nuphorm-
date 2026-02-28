import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, FileSpreadsheet } from 'lucide-react';
import type { Annotation } from '@/stores/regulatoryStore';

const HIGHLIGHT_BG: Record<string, string> = {
  yellow: 'bg-yellow-200 text-yellow-900',
  blue: 'bg-blue-200 text-blue-900',
  green: 'bg-green-200 text-green-900',
  purple: 'bg-purple-200 text-purple-900',
  orange: 'bg-orange-200 text-orange-900',
};

// Generates plausible mock content for preview.
// In production, fetch the actual file content from the files tRPC router.
function buildMockContent(sourceName: string, highlightText: string): string {
  const ext = sourceName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'csv') {
    return [
      'Patient ID,Treatment Group,Outcome Score,Adverse Events',
      '1001,Group A,87.3,None',
      '1002,Group B,72.1,Mild rash (resolved)',
      '1003,Group A,91.5,None',
      '1004,Group A,85.2,None',
      '1005,Group B,68.9,Nausea (resolved)',
      '1006,Group A,89.0,None',
      '',
      'Summary Statistics:',
      'N (Group A): 4   Mean: 88.25   SD: 2.47',
      'N (Group B): 2   Mean: 70.50   SD: 2.26',
      'P-value (two-tailed t-test): 0.0023',
      '',
      `Referenced section:\n${highlightText}`,
    ].join('\n');
  }
  if (ext === 'xlsx') {
    return [
      'Statistical Analysis Report',
      'Study: Phase III Clinical Trial',
      'Protocol: NP-2024-001',
      '',
      'Primary Endpoint Analysis',
      'The primary endpoint was assessed using a pre-specified statistical analysis plan.',
      'Intent-to-treat population (N=240) was analyzed per ICH E9 guidelines.',
      '',
      `Referenced section:\n${highlightText}`,
      '',
      'Secondary Endpoints',
      'All secondary endpoints demonstrated statistical significance at p < 0.05.',
      'No unexpected safety signals were identified during the study period.',
    ].join('\n');
  }
  // PDF / DOCX / default
  return [
    `Source: ${sourceName}`,
    '',
    'Executive Summary',
    'This document provides supporting data for the regulatory submission.',
    '',
    'Section 1 – Study Design',
    'A randomized, double-blind, placebo-controlled study was conducted across 12 clinical sites.',
    '',
    `Referenced section:\n${highlightText}`,
    '',
    'Section 2 – Safety Profile',
    'The device demonstrated an acceptable safety profile throughout the study period.',
    'All adverse events were mild to moderate and resolved without intervention.',
  ].join('\n');
}

interface SourcePreviewModalProps {
  annotation: Annotation;
  onClose: () => void;
}

export default function SourcePreviewModal({
  annotation,
  onClose,
}: SourcePreviewModalProps) {
  const { sourceName, text, color } = annotation;
  const ext = sourceName.split('.').pop()?.toUpperCase() ?? 'FILE';
  const isSpreadsheet = ['CSV', 'XLSX'].includes(ext);

  const rawContent = buildMockContent(sourceName, text);

  // Split the content on the highlighted text so we can inject the <mark>
  const parts = rawContent.split(text);
  const highlightClass = HIGHLIGHT_BG[color] ?? 'bg-yellow-200 text-yellow-900';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {isSpreadsheet ? (
              <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
            )}
            <span className="truncate">{sourceName}</span>
            <span className="ml-auto text-xs font-normal text-gray-400 flex-shrink-0">{ext}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Highlight notice */}
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <p className="text-xs text-amber-700">
            The referenced sentence is highlighted below.
          </p>
        </div>

        {/* Content preview */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="font-mono text-sm bg-gray-50 rounded-lg p-4 whitespace-pre-wrap leading-relaxed">
            {parts.map((part, idx) => (
              <span key={idx}>
                {part}
                {idx < parts.length - 1 && (
                  <mark
                    className={`${highlightClass} rounded px-0.5 not-italic font-medium`}
                  >
                    {text}
                  </mark>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex-shrink-0 bg-gray-50">
          <p className="text-xs text-gray-400">
            Preview only — source content is truncated for display purposes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
