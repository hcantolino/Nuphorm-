import { useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { useBiostatStore, getNextColor } from '@/stores/biostatStore';

export default function BiostatSidebar() {
  const {
    columns,
    selectedVariables,
    addVariable,
    removeVariable,
    sidebarOpen,
    toggleSidebar,
  } = useBiostatStore();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    'All Variables'
  );

  // Categorize columns (simple heuristic)
  const categorizeColumns = () => {
    const categories: Record<string, string[]> = {
      'All Variables': columns,
    };

    // Simple categorization based on column names
    const demographics = columns.filter((col) =>
      /age|gender|sex|race|ethnicity|weight|height|bmi/i.test(col)
    );
    const outcomes = columns.filter((col) =>
      /outcome|result|status|event|response/i.test(col)
    );
    const biomarkers = columns.filter((col) =>
      /marker|protein|antibody|level|count|value/i.test(col)
    );
    const dates = columns.filter((col) =>
      /date|time|visit|day|month|year/i.test(col)
    );

    if (demographics.length > 0) categories['Demographics'] = demographics;
    if (outcomes.length > 0) categories['Outcomes'] = outcomes;
    if (biomarkers.length > 0) categories['Biomarkers'] = biomarkers;
    if (dates.length > 0) categories['Dates'] = dates;

    return categories;
  };

  const categories = categorizeColumns();
  const selectedVarNames = selectedVariables.map((v) => v.name);

  const handleAddVariable = (colName: string) => {
    if (!selectedVarNames.includes(colName)) {
      addVariable({
        name: colName,
        type: 'numeric',
        color: getNextColor(),
      });
    }
  };

  if (!columns.length) {
    return (
      <div className="w-64 bg-gray-50 border-r border-gray-200 p-6 hidden lg:block">
        <p className="text-sm text-gray-600">
          Upload a dataset to see available variables
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={toggleSidebar}
        className="fixed bottom-6 left-6 z-40 lg:hidden p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto
          transform transition-transform duration-300 z-30 lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ paddingTop: 'calc(var(--header-height, 0px) + 1rem)' }}
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Variables</h2>

          {/* Selected Variables */}
          {selectedVariables.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                Selected ({selectedVariables.length})
              </h3>
              <div className="space-y-2">
                {selectedVariables.map((variable) => (
                  <div
                    key={variable.name}
                    className="flex items-center justify-between gap-2 p-2 bg-white border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: variable.color }}
                      />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {variable.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeVariable(variable.name)}
                      className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Variables by Category */}
          <div className="space-y-4">
            {Object.entries(categories).map(([category, vars]) => (
              <div key={category}>
                <button
                  onClick={() =>
                    setExpandedCategory(
                      expandedCategory === category ? null : category
                    )
                  }
                  className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {category}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      expandedCategory === category ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedCategory === category && (
                  <div className="mt-2 space-y-1 ml-2">
                    {vars.map((colName) => {
                      const isSelected = selectedVarNames.includes(colName);
                      return (
                        <button
                          key={colName}
                          onClick={() => handleAddVariable(colName)}
                          className={`
                            w-full text-left px-3 py-2 text-sm rounded-lg transition-colors
                            ${
                              isSelected
                                ? 'bg-blue-100 text-blue-900 font-medium'
                                : 'text-gray-700 hover:bg-gray-200'
                            }
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{colName}</span>
                            {isSelected ? (
                              <X className="w-4 h-4 flex-shrink-0" />
                            ) : (
                              <Plus className="w-4 h-4 flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
