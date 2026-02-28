import React, { useState } from 'react';
import { regulatoryTemplates, RegulatoryTemplate } from '@/data/regulatoryTemplates';
import { ChevronDown, FileText, Search } from 'lucide-react';

interface TemplateLibraryProps {
  onSelectTemplate: (templateId: string, standard: 'usFda' | 'euEma') => void;
}

export default function TemplateLibrary({ onSelectTemplate }: TemplateLibraryProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<RegulatoryTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const filteredTemplates = regulatoryTemplates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Regulatory Document Templates</h2>
        <p className="text-gray-600">
          Choose from pre-filled templates for IND, BLA, and NDA submissions. Templates auto-populate based on your selected regulatory standard.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <div className="lg:col-span-1">
          <div className="space-y-3">
            {filteredTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <FileText className="w-4 h-4" />
                      <span>~{template.estimatedPages} pages</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Template Preview */}
        {selectedTemplate && (
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{selectedTemplate.icon}</span>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedTemplate.name}</h3>
                  <p className="text-gray-600">{selectedTemplate.description}</p>
                </div>
              </div>
            </div>

            {/* Regulatory Standards */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Select Regulatory Standard</h4>

              {/* US FDA */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('us-fda')}
                  className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🇺🇸</span>
                    <div className="text-left">
                      <h5 className="font-semibold text-gray-900">US FDA</h5>
                      <p className="text-sm text-gray-600">
                        {selectedTemplate.standards.usFda.regulatoryNotes}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-600 transition-transform ${
                      expandedSections.includes('us-fda') ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSections.includes('us-fda') && (
                  <div className="p-4 bg-white border-t border-gray-200 space-y-3">
                    <div className="space-y-2">
                      <h6 className="font-semibold text-gray-900">Sections Included:</h6>
                      <ul className="space-y-1">
                        {selectedTemplate.standards.usFda.sections.map(section => (
                          <li key={section.id} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span>
                              {section.title}
                              {section.required && <span className="text-red-500 ml-1">*</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h6 className="font-semibold text-gray-900">Compliance Checklist:</h6>
                      <div className="text-sm text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                        {selectedTemplate.standards.usFda.complianceChecklist.map(item => (
                          <div key={item.id} className="flex items-start gap-2">
                            <span className={item.required ? 'text-red-500' : 'text-gray-400'}>
                              {item.required ? '✓' : '○'}
                            </span>
                            <span>{item.item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectTemplate(selectedTemplate.id, 'usFda')}
                      className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                    >
                      Use US FDA Template
                    </button>
                  </div>
                )}
              </div>

              {/* EU EMA */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('eu-ema')}
                  className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🇪🇺</span>
                    <div className="text-left">
                      <h5 className="font-semibold text-gray-900">EU EMA</h5>
                      <p className="text-sm text-gray-600">
                        {selectedTemplate.standards.euEma.regulatoryNotes}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-600 transition-transform ${
                      expandedSections.includes('eu-ema') ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSections.includes('eu-ema') && (
                  <div className="p-4 bg-white border-t border-gray-200 space-y-3">
                    <div className="space-y-2">
                      <h6 className="font-semibold text-gray-900">Sections Included:</h6>
                      <ul className="space-y-1">
                        {selectedTemplate.standards.euEma.sections.map(section => (
                          <li key={section.id} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span>
                              {section.title}
                              {section.required && <span className="text-red-500 ml-1">*</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h6 className="font-semibold text-gray-900">Compliance Checklist:</h6>
                      <div className="text-sm text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                        {selectedTemplate.standards.euEma.complianceChecklist.map(item => (
                          <div key={item.id} className="flex items-start gap-2">
                            <span className={item.required ? 'text-red-500' : 'text-gray-400'}>
                              {item.required ? '✓' : '○'}
                            </span>
                            <span>{item.item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectTemplate(selectedTemplate.id, 'euEma')}
                      className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                    >
                      Use EU EMA Template
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600">Try adjusting your search query</p>
        </div>
      )}
    </div>
  );
}
