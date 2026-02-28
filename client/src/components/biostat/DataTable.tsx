import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useBiostatStore } from '@/stores/biostatStore';

export default function DataTable() {
  const { data, columns, selectedVariables, showDataTable } = useBiostatStore();
  const [sorting, setSorting] = useState<SortingState>([]);

  // Filter to selected variables or show all if none selected
  const displayColumns = selectedVariables.length > 0
    ? selectedVariables.map((v) => v.name)
    : columns.slice(0, 10); // Show first 10 columns if none selected

  const tableColumns = useMemo<ColumnDef<Record<string, any>>[]>(
    () =>
      displayColumns.map((col) => ({
        accessorKey: col,
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-semibold text-gray-900 hover:text-gray-700"
          >
            {col}
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="w-4 h-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="w-4 h-4" />
            ) : null}
          </button>
        ),
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className="text-gray-700">
              {typeof value === 'number' ? value.toFixed(2) : String(value)}
            </span>
          );
        },
      })),
    [displayColumns]
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!showDataTable || !data.length) {
    return null;
  }

  return (
    <div className="bg-white border-t border-gray-200 p-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Supporting Data
        </h2>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-900"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-6 py-3 text-sm text-gray-700"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600 mt-4">
          Showing {table.getRowModel().rows.length} of {data.length} rows
        </p>
      </div>
    </div>
  );
}
