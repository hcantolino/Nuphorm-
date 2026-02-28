import React, { useState } from 'react';
import { regulatoryTemplates, generateDocumentFromTemplate } from '@/data/regulatoryTemplates';
import { X } from 'lucide-react';

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateId: string, standard: 'usFda' | 'euEma', content: string) => void;
  currentStandard: 'usFda' | 'euEma';
}

export default function TemplateSelector({
  isOpen,
  onClose,
  onSelectTemplate,
  currentStandard
}: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectTemplate = (templateId: string) => {
    const content = generateDocumentFromTemplate(templateId, currentStandard);
    onSelectTemplate(templateId, currentStandard, content);
    setSelectedTemplate(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Select Template</h2>
            <p className="text-gray-600 mt-1">
              Choose a template for {currentStandard === 'usFda' ? '🇺🇸 US FDA' : '🇪🇺 EU EMA'} submission
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Template Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {regulatoryTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template.id)}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{template.icon}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <span>📄 ~{template.estimatedPages} pages</span>
                  </div>

                  {/* Quick Info */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Includes:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {currentStandard === 'usFda'
                        ? template.standards.usFda.sections.slice(0, 3).map(section => (
                            <li key={section.id}>• {section.title}</li>
                          ))
                        : template.standards.euEma.sections.slice(0, 3).map(section => (
                            <li key={section.id}>• {section.title}</li>
                          ))}
                      <li className="text-blue-600 font-semibold">+ more...</li>
                    </ul>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Templates will auto-populate with sections for the selected regulatory standard
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
