/**
 * Mock AI Service for Nuphorm
 * Simulates document generation with source attribution and citation extraction
 * In production, this would call OpenAI API or similar LLM service
 */

export interface SourceSnippet {
  id: string;
  text: string;
  source: string;
  pageNumber?: number;
}

export interface GeneratedSection {
  id: string;
  heading: string;
  content: string;
  citations: SourceSnippet[];
}

export interface GeneratedDocumentData {
  title: string;
  documentType: string;
  sections: GeneratedSection[];
  summary: string;
  citations: SourceSnippet[];
  confidence: number;
}

/**
 * Mock document templates with placeholders
 */
const DOCUMENT_TEMPLATES: Record<string, Record<string, any>> = {
  '510k': {
    sections: [
      {
        heading: '1. Device Description',
        template:
          'The {{DEVICE_NAME}} is a {{DEVICE_TYPE}} designed for {{INTENDED_USE}}. This device incorporates {{MATERIALS}} and {{FEATURES}}.',
      },
      {
        heading: '2. Substantial Equivalence',
        template:
          'Substantial equivalence has been demonstrated through comparative analysis of device design, materials, performance characteristics, and intended use. The {{DEVICE_NAME}} is substantially equivalent to the predicate device in all material respects.',
      },
      {
        heading: '3. Performance Testing',
        template:
          'Performance testing has been conducted per {{STANDARDS}}. All critical parameters meet or exceed predicate device specifications. Test results are provided in Appendix A.',
      },
      {
        heading: '4. Safety and Biocompatibility',
        template:
          'Safety and biocompatibility testing has been conducted per ISO 10993. {{BIOCOMPAT_RESULTS}}. The device is safe for its intended use.',
      },
      {
        heading: '5. Labeling and Instructions',
        template:
          'Complete labeling and instructions for use are provided. All warnings and precautions are clearly stated. Labeling complies with 21 CFR 801.',
      },
    ],
    summary:
      'This 510(k) submission demonstrates substantial equivalence to the predicate device through comprehensive comparative analysis and testing.',
  },
  pma: {
    sections: [
      {
        heading: 'Executive Summary',
        template:
          'This Premarket Approval (PMA) application provides comprehensive clinical and technical data supporting the safety and effectiveness of the {{DEVICE_NAME}} for {{INTENDED_USE}}.',
      },
      {
        heading: 'Clinical Summary',
        template:
          'Clinical data from {{CLINICAL_TRIALS}} demonstrates that the {{DEVICE_NAME}} is safe and effective. {{CLINICAL_RESULTS}}.',
      },
      {
        heading: 'Technical Data',
        template:
          'Comprehensive technical specifications including design files, materials analysis, and manufacturing processes are provided. {{TECHNICAL_SPECS}}.',
      },
      {
        heading: 'Safety Profile',
        template:
          'The safety profile has been thoroughly evaluated through preclinical testing, clinical trials, and risk analysis per ISO 14971. {{SAFETY_RESULTS}}.',
      },
      {
        heading: 'Effectiveness Data',
        template:
          'Effectiveness has been demonstrated through clinical trials showing {{EFFECTIVENESS_METRICS}}. Statistical analysis supports the primary efficacy endpoints.',
      },
    ],
    summary:
      'This PMA application demonstrates that the device is safe and effective for its intended use based on comprehensive clinical and technical evidence.',
  },
  dmr: {
    sections: [
      {
        heading: 'Device Identification',
        template: 'Device Name: {{DEVICE_NAME}}\nDevice Type: {{DEVICE_TYPE}}\nIntended Use: {{INTENDED_USE}}',
      },
      {
        heading: 'Design and Development',
        template:
          'Design specifications and development records are maintained per 21 CFR 820.30. {{DESIGN_RECORDS}}.',
      },
      {
        heading: 'Manufacturing Information',
        template:
          'Manufacturing procedures, specifications, and quality standards are documented. {{MANUFACTURING_SPECS}}.',
      },
      {
        heading: 'Quality Control Records',
        template:
          'Quality control records, test results, and inspection records are maintained per 21 CFR 820.75. {{QC_RECORDS}}.',
      },
      {
        heading: 'Complaint Files and Adverse Events',
        template:
          'All complaints and adverse events are documented, investigated, and reported per 21 CFR 803 and 806. {{COMPLAINT_RECORDS}}.',
      },
    ],
    summary: 'Device Medical Records maintained per 21 CFR 820.184.',
  },
};

/**
 * Mock source data for citations
 */
const MOCK_SOURCES = [
  {
    id: 'src-1',
    title: 'Predicate Device Specifications',
    snippets: [
      'Device is substantially equivalent in design and performance',
      'Material composition: Stainless steel 316L with biocompatible coating',
      'Performance specifications exceed FDA requirements',
      'Intended use: Diagnostic testing in clinical settings',
    ],
  },
  {
    id: 'src-2',
    title: 'Clinical Trial Results',
    snippets: [
      'Clinical trial enrolled 500 patients across 10 sites',
      'Primary endpoint achieved with 95% confidence interval',
      'Safety profile consistent with predicate device',
      'No serious adverse events reported',
      'Sensitivity: 98.5%, Specificity: 97.2%',
    ],
  },
  {
    id: 'src-3',
    title: 'FDA Guidance Documents',
    snippets: [
      '510(k) submissions should include substantial equivalence analysis',
      'Biocompatibility testing per ISO 10993 is required',
      'Risk analysis per ISO 14971 is recommended',
      'Labeling must comply with 21 CFR 801',
    ],
  },
  {
    id: 'src-4',
    title: 'ISO Standards',
    snippets: [
      'ISO 13485: Medical devices quality management systems',
      'ISO 14971: Medical devices risk management',
      'ISO 10993: Biocompatibility evaluation of medical devices',
      'ISO 9001: General quality management principles',
    ],
  },
];

/**
 * Generate mock document with source attribution
 * Simulates AI processing with citation extraction
 */
export async function generateMockDocument(
  documentType: string,
  deviceInfo: {
    deviceName: string;
    deviceType: string;
    intendedUse: string;
    materials?: string;
    features?: string;
  },
  userMessage: string,
  sourceDocuments?: any[]
): Promise<GeneratedDocumentData> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));

  const template = DOCUMENT_TEMPLATES[documentType] || DOCUMENT_TEMPLATES['510k'];

  // Generate sections with mock citations
  const sections: GeneratedSection[] = template.sections.map((section: any, index: number) => {
    let content = section.template
      .replace('{{DEVICE_NAME}}', deviceInfo.deviceName)
      .replace('{{DEVICE_TYPE}}', deviceInfo.deviceType)
      .replace('{{INTENDED_USE}}', deviceInfo.intendedUse)
      .replace('{{MATERIALS}}', deviceInfo.materials || 'advanced materials')
      .replace('{{FEATURES}}', deviceInfo.features || 'innovative design features')
      .replace('{{STANDARDS}}', 'FDA guidance and ISO standards')
      .replace('{{CLINICAL_TRIALS}}', 'multi-center clinical trials')
      .replace('{{CLINICAL_RESULTS}}', 'positive safety and efficacy results')
      .replace('{{TECHNICAL_SPECS}}', 'comprehensive technical specifications')
      .replace('{{SAFETY_RESULTS}}', 'favorable safety profile')
      .replace('{{EFFECTIVENESS_METRICS}}', 'primary and secondary endpoints')
      .replace('{{DESIGN_RECORDS}}', 'complete design history file maintained')
      .replace('{{MANUFACTURING_SPECS}}', 'standard operating procedures documented')
      .replace('{{QC_RECORDS}}', 'comprehensive quality control documentation')
      .replace('{{COMPLAINT_RECORDS}}', 'complaint handling procedures established')
      .replace('{{BIOCOMPAT_RESULTS}}', 'all tests passed with acceptable results');

    // Assign citations from mock sources
    const citations = MOCK_SOURCES.slice(index % 2, (index % 2) + 2).flatMap((source) =>
      source.snippets.slice(0, 2).map((snippet, idx) => ({
        id: `${source.id}-${idx}`,
        text: snippet,
        source: source.title,
        pageNumber: Math.floor(Math.random() * 20) + 1,
      }))
    );

    return {
      id: `sec-${index}`,
      heading: section.heading,
      content,
      citations,
    };
  });

  // Aggregate all citations
  const allCitations = sections.flatMap((s) => s.citations);

  return {
    title: `${documentType.toUpperCase()} - ${deviceInfo.deviceName}`,
    documentType,
    sections,
    summary: template.summary,
    citations: allCitations,
    confidence: 0.85 + Math.random() * 0.1, // 0.85-0.95
  };
}

/**
 * Extract citations from document content
 * Simulates AI citation extraction
 */
export function extractCitations(content: string, sources: any[]): SourceSnippet[] {
  // Mock implementation: return random snippets from sources
  const citations: SourceSnippet[] = [];

  sources.forEach((source) => {
    const numSnippets = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numSnippets; i++) {
      citations.push({
        id: `cite-${source.id}-${i}`,
        text: source.content?.substring(0, 100) || `Reference from ${source.name}`,
        source: source.name,
        pageNumber: Math.floor(Math.random() * 20) + 1,
      });
    }
  });

  return citations;
}

/**
 * Fetch mock abstracts from PubMed/FDA
 * Simulates external API calls
 */
export async function fetchMockAbstracts(query: string): Promise<any[]> {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 800));

  return [
    {
      id: 'pubmed-1',
      title: `Research on ${query}`,
      abstract: `This study investigates ${query} with promising results...`,
      authors: 'Smith, J., et al.',
      year: 2024,
      source: 'PubMed',
    },
    {
      id: 'pubmed-2',
      title: `Clinical evaluation of ${query}`,
      abstract: `A comprehensive review of ${query} in clinical practice...`,
      authors: 'Johnson, M., et al.',
      year: 2023,
      source: 'PubMed',
    },
  ];
}

/**
 * Validate document for hallucinations
 * Checks that all claims are supported by sources
 */
export function validateDocumentAccuracy(
  document: GeneratedDocumentData,
  sources: any[]
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check that all sections have citations
  document.sections.forEach((section) => {
    if (!section.citations || section.citations.length === 0) {
      issues.push(`Section "${section.heading}" has no source citations`);
    }
  });

  // Check citation sources exist
  document.citations.forEach((citation) => {
    const sourceExists = sources.some((s) => s.id === citation.source);
    if (!sourceExists) {
      issues.push(`Citation references unknown source: ${citation.source}`);
    }
  });

  return {
    isValid: issues.length === 0,
    issues,
  };
}
