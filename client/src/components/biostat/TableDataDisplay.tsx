import React from 'react';
import { TableData } from '@/stores/chartStore';

interface TableDataDisplayProps {
  tableData: TableData | null;
  selectedVariables: Array<{ name: string; color: string }>;
  filteredData: any[];
}

export const TableDataDisplay: React.FC<TableDataDisplayProps> = ({
  tableData,
  selectedVariables,
  filteredData,
}) => {
  const displayData = tableData || (selectedVariables.length > 0 && filteredData.length > 0);

  if (!displayData) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-auto max-h-64">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Data Table</h3>
      {tableData ? (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {tableData.headers.map((header) => (
                <th key={header} className="px-4 py-2 text-left font-medium text-gray-700">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.slice(0, 10).map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                {row.map((cell, cellIdx) => (
                  <td key={`${idx}-${cellIdx}`} className="px-4 py-2 text-gray-700">
                    {typeof cell === 'number' ? cell.toFixed(2) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {selectedVariables.map((variable) => (
                <th key={variable.name} className="px-4 py-2 text-left font-medium text-gray-700">
                  {variable.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.slice(0, 10).map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                {selectedVariables.map((variable) => (
                  <td key={`${idx}-${variable.name}`} className="px-4 py-2 text-gray-700">
                    {typeof row[variable.name] === 'number'
                      ? row[variable.name].toFixed(2)
                      : row[variable.name]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(tableData?.rows.length || filteredData.length) > 10 && (
        <p className="text-xs text-gray-500 mt-2">
          Showing 10 of {tableData?.rows.length || filteredData.length} rows
        </p>
      )}
    </div>
  );
};
