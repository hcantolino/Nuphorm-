import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ResultsTableRow {
  metric: string;
  value: string | number;
  submetric?: string;
  subvalue?: string | number;
}

interface GeneExpressionResultsTableProps {
  data: ResultsTableRow[];
  title?: string;
  maxRows?: number;
}

/**
 * Gene Expression Results Table Component
 * Displays computed statistics and top genes with fold-change values
 */
export const GeneExpressionResultsTable: React.FC<GeneExpressionResultsTableProps> = ({
  data,
  title = 'Gene Expression Analysis Results',
  maxRows = 20,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No results available</p>
      </div>
    );
  }

  const displayData = data.slice(0, maxRows);

  return (
    <div className="w-full bg-white rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="font-semibold text-gray-700">Metric</TableHead>
              <TableHead className="font-semibold text-gray-700">Value</TableHead>
              {data.some((row) => row.submetric) && (
                <>
                  <TableHead className="font-semibold text-gray-700">
                    Sub-Metric
                  </TableHead>
                  <TableHead className="font-semibold text-gray-700">
                    Sub-Value
                  </TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((row, idx) => (
              <TableRow
                key={idx}
                className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                <TableCell className="font-medium text-gray-800">
                  {row.metric}
                </TableCell>
                <TableCell className="text-gray-700">
                  {typeof row.value === 'number'
                    ? row.value.toFixed(3)
                    : row.value}
                </TableCell>
                {data.some((r) => r.submetric) && (
                  <>
                    <TableCell className="text-gray-700">
                      {row.submetric || '-'}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {row.subvalue
                        ? typeof row.subvalue === 'number'
                          ? row.subvalue.toFixed(3)
                          : row.subvalue
                        : '-'}
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.length > maxRows && (
        <p className="mt-4 text-sm text-gray-500">
          Showing {maxRows} of {data.length} results
        </p>
      )}
    </div>
  );
};

export default GeneExpressionResultsTable;
