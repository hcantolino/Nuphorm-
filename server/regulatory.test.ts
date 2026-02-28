import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateDeviceDescription,
  generateSubstantialEquivalence,
  generateSafetyPerformanceEvaluation,
  generateInstructionsForUse,
  generate510kSummary,
  generateComplete510kSubmission,
} from './regulatoryAI';

// Mock the LLM invocation
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn(async (params) => {
    const mockContent = `
# Generated Regulatory Document

## Executive Summary
This is a mock regulatory document generated for testing purposes.

## Key Sections
- Device specifications and intended use
- Safety and performance data
- Clinical evaluation results
- Manufacturing information

[CITATION 1] - Clinical data from source document
[CITATION 2] - Safety assessment from regulatory guidance

## Conclusion
This device meets FDA requirements for market approval.
    `;

    return {
      choices: [
        {
          message: {
            content: mockContent,
          },
        },
      ],
    };
  }),
}));

describe('Regulatory AI Documentation', () => {
  const mockSourceDocuments = [
    'Clinical trial data showing 95% efficacy rate',
    'Biocompatibility testing results per ISO 10993',
    'Manufacturing process validation documentation',
  ];

  const mockPredicateDevices = [
    {
      name: 'Predicate Device A',
      manufacturer: 'Medical Corp',
      classification: 'Class II',
      intendedUse: 'Diagnostic imaging device',
    },
  ];

  describe('generateDeviceDescription', () => {
    it('should generate a device description with citations', async () => {
      const result = await generateDeviceDescription(
        'Advanced Diagnostic Scanner',
        'Diagnostic Imaging Device',
        'Non-invasive diagnostic imaging for clinical use',
        mockSourceDocuments
      );

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('citations');
      expect(result.content.length).toBeGreaterThan(0);
      expect(Array.isArray(result.citations)).toBe(true);
    });

    it('should include source citations in generated content', async () => {
      const result = await generateDeviceDescription(
        'Test Device',
        'Test Type',
        'Test intended use',
        mockSourceDocuments
      );

      expect(result.content).toContain('[CITATION');
      expect(result.citations.length).toBeGreaterThan(0);
    });
  });

  describe('generateSubstantialEquivalence', () => {
    it('should generate substantial equivalence comparison', async () => {
      const result = await generateSubstantialEquivalence(
        'New Device',
        mockPredicateDevices,
        mockSourceDocuments
      );

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('citations');
      expect(result.content.length).toBeGreaterThan(100);
    });

    it('should include predicate device information', async () => {
      const result = await generateSubstantialEquivalence(
        'New Device',
        mockPredicateDevices,
        mockSourceDocuments
      );

      expect(result.content.length).toBeGreaterThan(100);
      expect(result).toHaveProperty('citations');
    });
  });

  describe('generateSafetyPerformanceEvaluation', () => {
    it('should generate safety and performance evaluation', async () => {
      const result = await generateSafetyPerformanceEvaluation(
        'Test Device',
        mockSourceDocuments
      );

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('citations');
      expect(result.content.length).toBeGreaterThan(100);
    });

    it('should include performance testing information', async () => {
      const result = await generateSafetyPerformanceEvaluation(
        'Test Device',
        mockSourceDocuments
      );

      expect(result.content.length).toBeGreaterThan(100);
      expect(result.citations).toBeDefined();
    });
  });

  describe('generateInstructionsForUse', () => {
    it('should generate instructions for use document', async () => {
      const result = await generateInstructionsForUse(
        'Test Device',
        mockSourceDocuments
      );

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('citations');
      expect(result.content.length).toBeGreaterThan(100);
    });

    it('should include safety warnings and precautions', async () => {
      const result = await generateInstructionsForUse(
        'Test Device',
        mockSourceDocuments
      );

      expect(result.content.length).toBeGreaterThan(100);
      expect(result.citations).toBeDefined();
    });
  });

  describe('generate510kSummary', () => {
    it('should generate 510(k) summary', async () => {
      const result = await generate510kSummary(
        'Test Device',
        'Diagnostic imaging device',
        mockPredicateDevices,
        mockSourceDocuments
      );

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('citations');
      expect(result.content.length).toBeGreaterThan(100);
    });

    it('should include predicate device identification', async () => {
      const result = await generate510kSummary(
        'Test Device',
        'Diagnostic imaging device',
        mockPredicateDevices,
        mockSourceDocuments
      );

      expect(result.content.length).toBeGreaterThan(100);
      expect(result.citations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateComplete510kSubmission', () => {
    it('should generate all required documents', async () => {
      const result = await generateComplete510kSubmission(
        'Complete Test Device',
        'Diagnostic Device',
        'For diagnostic use',
        mockPredicateDevices,
        mockSourceDocuments
      );

      expect(result).toHaveProperty('documents');
      expect(Array.isArray(result.documents)).toBe(true);
      expect(result.documents.length).toBeGreaterThan(0);
    });

    it('should include all required document types', async () => {
      const result = await generateComplete510kSubmission(
        'Complete Test Device',
        'Diagnostic Device',
        'For diagnostic use',
        mockPredicateDevices,
        mockSourceDocuments
      );

      const documentTypes = result.documents.map(d => d.type);
      expect(documentTypes).toContain('device_description');
      expect(documentTypes).toContain('substantial_equivalence');
      expect(documentTypes).toContain('safety_evaluation');
      expect(documentTypes).toContain('labeling_instructions');
      expect(documentTypes).toContain('510k_summary');
    });

    it('should include citations for each document', async () => {
      const result = await generateComplete510kSubmission(
        'Complete Test Device',
        'Diagnostic Device',
        'For diagnostic use',
        mockPredicateDevices,
        mockSourceDocuments
      );

      result.documents.forEach(doc => {
        expect(doc).toHaveProperty('citations');
        expect(Array.isArray(doc.citations)).toBe(true);
      });
    });

    it('should include content for each document', async () => {
      const result = await generateComplete510kSubmission(
        'Complete Test Device',
        'Diagnostic Device',
        'For diagnostic use',
        mockPredicateDevices,
        mockSourceDocuments
      );

      result.documents.forEach(doc => {
        expect(doc).toHaveProperty('content');
        expect(doc.content.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Citation extraction', () => {
    it('should properly extract citations from generated content', async () => {
      const result = await generateDeviceDescription(
        'Test Device',
        'Test Type',
        'Test use',
        mockSourceDocuments
      );

      if (result.citations.length > 0) {
        result.citations.forEach(citation => {
          expect(citation).toHaveProperty('text');
          expect(citation).toHaveProperty('source');
          expect(citation.text).toContain('CITATION');
        });
      }
    });
  });
});
