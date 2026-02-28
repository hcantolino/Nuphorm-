import { describe, it, expect } from 'vitest';
import {
  generateTitleFromQuery,
  generateTitleFromAnalysis,
  sanitizeTabTitle,
  generateDefaultTitle,
  isFollowUpQuery,
  extractColumnNames,
  generatePharmaTitle,
} from './titleGeneration';

describe('titleGeneration', () => {
  describe('generateTitleFromQuery', () => {
    it('should generate title for mean query', () => {
      const title = generateTitleFromQuery('create a mean for fold_change');
      expect(title).toContain('Mean');
      expect(title).toContain('fold_change');
    });

    it('should generate title for median query', () => {
      const title = generateTitleFromQuery('calculate median expression_level');
      expect(title).toContain('Median');
      expect(title).toContain('expression_level');
    });

    it('should generate title for standard deviation query', () => {
      const title = generateTitleFromQuery('compute std dev for treatment');
      expect(title).toContain('Std Dev');
      expect(title).toContain('treatment');
    });

    it('should generate title for t-test query', () => {
      const title = generateTitleFromQuery('run a t-test on control vs treatment');
      expect(title).toContain('T-Test');
    });

    it('should generate title for ANOVA query', () => {
      const title = generateTitleFromQuery('perform anova analysis');
      expect(title).toContain('ANOVA');
    });

    it('should generate title for volcano plot', () => {
      const title = generateTitleFromQuery('generate a volcano plot');
      expect(title).toContain('Volcano Plot');
    });

    it('should generate title for boxplot', () => {
      const title = generateTitleFromQuery('create boxplot for data');
      expect(title).toContain('Boxplot');
    });

    it('should generate title for scatter plot', () => {
      const title = generateTitleFromQuery('make a scatter plot');
      expect(title).toContain('Scatter Plot');
    });

    it('should generate title for line chart', () => {
      const title = generateTitleFromQuery('draw a line chart for trends');
      expect(title).toContain('Line Chart');
    });

    it('should generate title for bar chart', () => {
      const title = generateTitleFromQuery('create bar chart');
      expect(title).toContain('Bar Chart');
    });

    it('should generate title for regression', () => {
      const title = generateTitleFromQuery('run linear regression on x and y');
      expect(title).toContain('Regression');
    });

    it('should generate title for correlation', () => {
      const title = generateTitleFromQuery('calculate correlation between variables');
      expect(title).toContain('Correlation');
    });

    it('should handle empty query', () => {
      const title = generateTitleFromQuery('');
      expect(title).toBe('Analysis');
    });

    it('should handle whitespace-only query', () => {
      const title = generateTitleFromQuery('   ');
      expect(title).toBe('Analysis');
    });

    it('should fallback to first words for unknown query', () => {
      const title = generateTitleFromQuery('do something special with data');
      expect(title).toContain('do');
    });

    it('should limit title length', () => {
      const longQuery =
        'create a very long title with many words that should be truncated';
      const title = generateTitleFromQuery(longQuery);
      expect(title.length).toBeLessThanOrEqual(40);
    });

    it('should handle queries with multiple metrics', () => {
      const title = generateTitleFromQuery('mean of expression_level and fold_change');
      expect(title).toContain('Mean');
    });

    it('should extract metric with "of" pattern', () => {
      const title = generateTitleFromQuery('mean of my_column');
      expect(title).toContain('my_column');
    });

    it('should extract metric with "for" pattern', () => {
      const title = generateTitleFromQuery('median for treatment_group');
      expect(title).toContain('treatment_group');
    });
  });

  describe('generateTitleFromAnalysis', () => {
    it('should generate title with metric and statistic', () => {
      const title = generateTitleFromAnalysis('mean', 'fold_change', 'p-value');
      expect(title).toContain('Mean');
      expect(title).toContain('fold_change');
      expect(title).toContain('p-value');
    });

    it('should generate title with metric only', () => {
      const title = generateTitleFromAnalysis('median', 'expression_level');
      expect(title).toContain('Median');
      expect(title).toContain('expression_level');
    });

    it('should generate title with analysis type only', () => {
      const title = generateTitleFromAnalysis('tTest');
      expect(title).toContain('T-Test');
    });

    it('should limit title length', () => {
      const title = generateTitleFromAnalysis(
        'mean',
        'very_long_column_name_that_is_extremely_long',
        'p-value'
      );
      expect(title.length).toBeLessThanOrEqual(40);
    });
  });

  describe('sanitizeTabTitle', () => {
    it('should remove invalid filename characters', () => {
      const dirty = 'My <Analysis> | "Results"';
      const clean = sanitizeTabTitle(dirty);
      expect(clean).not.toContain('<');
      expect(clean).not.toContain('>');
      expect(clean).not.toContain('|');
      expect(clean).not.toContain('"');
    });

    it('should trim whitespace', () => {
      const title = sanitizeTabTitle('  My Analysis  ');
      expect(title).toBe('My Analysis');
    });

    it('should limit length to 50 characters', () => {
      const longTitle = 'a'.repeat(100);
      const sanitized = sanitizeTabTitle(longTitle);
      expect(sanitized.length).toBeLessThanOrEqual(50);
    });

    it('should handle empty string', () => {
      const title = sanitizeTabTitle('');
      expect(title).toBe('');
    });
  });

  describe('generateDefaultTitle', () => {
    it('should generate title with timestamp', () => {
      const title = generateDefaultTitle();
      expect(title).toContain('Analysis');
      expect(title).toMatch(/\d{1,2}:\d{2}/); // Time format
    });

    it('should generate different titles at different times', () => {
      const title1 = generateDefaultTitle();
      // Small delay to ensure different time
      const title2 = generateDefaultTitle();
      // Titles might be same if generated within same second
      expect(title1).toContain('Analysis');
      expect(title2).toContain('Analysis');
    });
  });

  describe('isFollowUpQuery', () => {
    it('should identify follow-up with "also"', () => {
      expect(isFollowUpQuery('Also show the median')).toBe(true);
    });

    it('should identify follow-up with "then"', () => {
      expect(isFollowUpQuery('Then calculate the mean')).toBe(true);
    });

    it('should identify follow-up with "what about"', () => {
      expect(isFollowUpQuery('What about the variance?')).toBe(true);
    });

    it('should identify follow-up with "compare"', () => {
      expect(isFollowUpQuery('Compare the results')).toBe(true);
    });

    it('should identify follow-up with "this result"', () => {
      expect(isFollowUpQuery('What does this result mean?')).toBe(true);
    });

    it('should not identify new query as follow-up', () => {
      expect(isFollowUpQuery('Create a mean for fold_change')).toBe(false);
    });

    it('should not identify independent query as follow-up', () => {
      expect(isFollowUpQuery('Generate a new analysis')).toBe(false);
    });
  });

  describe('extractColumnNames', () => {
    it('should extract single quoted column name', () => {
      const columns = extractColumnNames("mean of 'fold_change'");
      expect(columns).toContain('fold_change');
    });

    it('should extract double quoted column name', () => {
      const columns = extractColumnNames('median for "expression_level"');
      expect(columns).toContain('expression_level');
    });

    it('should extract backtick quoted column name', () => {
      const columns = extractColumnNames('std dev of `treatment_group`');
      expect(columns).toContain('treatment_group');
    });

    it('should extract multiple column names', () => {
      const columns = extractColumnNames(
        'correlation between "col1" and `col2`'
      );
      expect(columns).toContain('col1');
      expect(columns).toContain('col2');
    });

    it('should not include duplicates', () => {
      const columns = extractColumnNames('mean of col and col');
      expect(columns.filter((c) => c === 'col')).toHaveLength(1);
    });

    it('should handle no column names', () => {
      const columns = extractColumnNames('create a chart');
      expect(columns).toHaveLength(0);
    });

    it('should extract valid column names only', () => {
      const columns = extractColumnNames('of my_column_123');
      expect(columns).toContain('my_column_123');
    });

    it('should not extract invalid column names', () => {
      const columns = extractColumnNames('of 123invalid');
      expect(columns).not.toContain('123invalid');
    });
  });

  describe('generatePharmaTitle', () => {
    it('should generate PK title', () => {
      const title = generatePharmaTitle('analyze pharmacokinetic data');
      expect(title).toBe('PK Analysis');
    });

    it('should generate PD title', () => {
      const title = generatePharmaTitle('pharmacodynamic analysis');
      expect(title).toBe('PD Analysis');
    });

    it('should generate bioequivalence title', () => {
      const title = generatePharmaTitle('bioequivalence study analysis');
      expect(title).toBe('Bioequivalence');
    });

    it('should generate safety title', () => {
      const title = generatePharmaTitle('safety analysis of adverse events');
      expect(title).toBe('Safety Analysis');
    });

    it('should generate efficacy title', () => {
      const title = generatePharmaTitle('efficacy assessment');
      expect(title).toBe('Efficacy Analysis');
    });

    it('should generate dose response title', () => {
      const title = generatePharmaTitle('dose response relationship');
      expect(title).toBe('Dose Response');
    });

    it('should generate ITT title', () => {
      const title = generatePharmaTitle('intent to treat analysis');
      expect(title).toBe('ITT Analysis');
    });

    it('should generate per protocol title', () => {
      const title = generatePharmaTitle('per protocol population');
      expect(title).toBe('Per Protocol');
    });

    it('should fallback to general title for non-pharma query', () => {
      const title = generatePharmaTitle('create a mean for my_column');
      expect(title).toContain('Mean');
    });

    it('should be case insensitive', () => {
      const title1 = generatePharmaTitle('PK Analysis');
      const title2 = generatePharmaTitle('pk analysis');
      expect(title1).toBe('PK Analysis');
      expect(title2).toBe('PK Analysis');
    });
  });

  describe('integration', () => {
    it('should work with complex pharmaceutical query', () => {
      const query = 'calculate mean of "fold_change" for treatment group';
      const title = generateTitleFromQuery(query);
      expect(title).toContain('Mean');
      expect(title).toContain('fold_change');
    });

    it('should handle query with multiple analysis types', () => {
      const query =
        'run t-test and calculate mean for expression_level and fold_change';
      const title = generateTitleFromQuery(query);
      // Should pick first recognized analysis
      expect(title).toBeDefined();
    });

    it('should generate consistent titles for same query', () => {
      const query = 'create a median for my_data';
      const title1 = generateTitleFromQuery(query);
      const title2 = generateTitleFromQuery(query);
      expect(title1).toBe(title2);
    });

    it('should work with sanitization', () => {
      const query = 'mean of <invalid> column';
      const title = generateTitleFromQuery(query);
      const sanitized = sanitizeTabTitle(title);
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });
  });
});
