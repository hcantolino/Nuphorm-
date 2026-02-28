import React from 'react';
import { Card } from '@/components/ui/card';

interface ResultRow {
  metric: string;
  value: number | string | boolean;
  interpretation?: string;
}

interface ResultsTableProps {
  title?: string;
  results: ResultRow[];
  analysisType?: string;
}

export default function ResultsTable({ title, results, analysisType }: ResultsTableProps) {
  if (!results || results.length === 0) {
    return null;
  }

  const formatValue = (value: any) => {
    if (typeof value === 'number') {
      return value.toFixed(4);
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  };

  return (
    <Card className="p-4 mt-4 bg-slate-50 dark:bg-slate-900">
      <div className="space-y-3">
        {title && (
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-50">
            {title}
          </h3>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300">
                  Metric
                </th>
                <th className="text-right py-2 px-3 font-medium text-slate-700 dark:text-slate-300">
                  Value
                </th>
                {results.some((r) => r.interpretation) && (
                  <th className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300">
                    Interpretation
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {results.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <td className="py-2 px-3 text-slate-900 dark:text-slate-50">
                    {row.metric}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                    {formatValue(row.value)}
                  </td>
                  {results.some((r) => r.interpretation) && (
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 text-xs">
                      {row.interpretation || ''}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {analysisType && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Analysis type: <span className="font-medium">{analysisType}</span>
          </p>
        )}
      </div>
    </Card>
  );
}
