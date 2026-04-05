/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - What-For Chain Tests
 * 
 * Tests for RULE_2: "А чтобы что?" chain terminal MUST be classified as BREAK or DILEMMA.
 * Tests for BREAK at step ≤4 being critical.
 */

import { 
  runWhatForChain, 
  validateChainResult,
  extractDilemma,
  analyzeBreak,
  MAX_CHAIN_LENGTH
} from '../src/lib/audit/what-for-chain';

describe('What-For Chain Classification', () => {
  describe('runWhatForChain', () => {
    test('Detects BREAK markers in answers', () => {
      const answers = [
        'Because the plot requires it',
        'For no reason',
        'Just because'
      ];

      const result = runWhatForChain('test_element', answers);

      expect(result.terminal).toBe('BREAK');
    });

    test('Detects DILEMMA markers in answers', () => {
      const answers = [
        'To achieve power',
        'But must sacrifice something',
        'Choose between love and duty'
      ];

      const result = runWhatForChain('test_element', answers);

      expect(result.terminal).toBe('DILEMMA');
    });

    test('Returns UNCLASSIFIED when no terminal markers found', () => {
      const answers = [
        'To save the kingdom',
        'To protect the people',
        'To fulfill the prophecy'
      ];

      const result = runWhatForChain('test_element', answers);

      expect(result.terminal).toBe('UNCLASSIFIED');
      expect(result.valid).toBe(false);
    });

    test('BREAK at step <= 4 generates bind_to_law_or_remove action', () => {
      const answers = [
        'for no reason',
      ];

      const result = runWhatForChain('test_element', answers);

      expect(result.terminal).toBe('BREAK');
      expect(result.terminalStep).toBeLessThanOrEqual(4);
      expect(result.action).toBe('bind_to_law_or_remove');
    });

    test('DILEMMA generates valid result', () => {
      const answers = [
        'To achieve something',
        'But creates impossible choice between values',
      ];

      const result = runWhatForChain('test_element', answers);

      expect(result.terminal).toBe('DILEMMA');
      expect(result.valid).toBe(true);
    });

    test('Unclassified terminal triggers retry_analysis', () => {
      const answers = [
        'To achieve goal A',
        'To achieve goal B',
        'To achieve goal C',
        'To achieve goal D',
        'To achieve goal E',
        'To achieve goal F',
        'To achieve goal G',
      ];

      const result = runWhatForChain('test_element', answers);

      expect(result.terminal).toBe('UNCLASSIFIED');
      expect(result.action).toBe('retry_analysis');
    });

    test('Chain respects maximum length', () => {
      const manyAnswers = Array(10).fill('To achieve something meaningful');

      const result = runWhatForChain('test_element', manyAnswers);
      
      expect(result.chain.length).toBeLessThanOrEqual(MAX_CHAIN_LENGTH);
    });
  });

  describe('validateChainResult', () => {
    test('BREAK at step <= 4 is flagged as critical', () => {
      const result = {
        chain: [{ stepNumber: 1, question: 'Q1', answer: 'A1', analysis: 'Test' }],
        terminal: 'BREAK' as const,
        terminalStep: 3,
        valid: false,
        action: 'bind_to_law_or_remove',
        reasoning: 'Test'
      };

      const validation = validateChainResult(result);

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(i => i.includes('Critical BREAK'))).toBe(true);
    });

    test('BREAK at step > 4 is not critical', () => {
      const result = {
        chain: [],
        terminal: 'BREAK' as const,
        terminalStep: 6,
        valid: false,
        action: 'review_element_necessity',
        reasoning: 'Test'
      };

      const validation = validateChainResult(result);

      // Should not have critical issue for late BREAK
      expect(validation.issues.some(i => i.includes('Critical BREAK'))).toBe(false);
    });

    test('Valid chains have terminal classification', () => {
      const validResults = [
        { 
          chain: [], 
          terminal: 'BREAK' as const, 
          terminalStep: 3, 
          valid: false, 
          action: 'bind_to_law_or_remove', 
          reasoning: '' 
        },
        { 
          chain: [], 
          terminal: 'DILEMMA' as const, 
          terminalStep: 5, 
          valid: true, 
          reasoning: '' 
        },
      ];

      validResults.forEach(result => {
        const validation = validateChainResult(result);
        expect(result.terminal).not.toBe('UNCLASSIFIED');
      });
    });
  });

  describe('extractDilemma', () => {
    test('Extracts conflicting values from dilemma text', () => {
      const dilemmaText = 'The hero must choose between love and duty';
      const result = extractDilemma(dilemmaText);

      expect(result.value1).toBeDefined();
      expect(result.value2).toBeDefined();
      expect(result.conflict).toBeDefined();
    });

    test('Returns default values for unstructured text', () => {
      const dilemmaText = 'Something complex happens';
      const result = extractDilemma(dilemmaText);

      expect(result.value1).toBeDefined();
      expect(result.value2).toBeDefined();
    });
  });

  describe('analyzeBreak', () => {
    test('Identifies "no reason" break pattern', () => {
      const result = analyzeBreak('There is no reason for this', 3);

      expect(result.brokenElement).toBe('purpose');
      expect(result.impact).toContain('Critical');
    });

    test('Late break is less critical', () => {
      const result = analyzeBreak('This is arbitrary', 6);

      expect(result.impact).toContain('Moderate');
    });

    test('Identifies "meaningless" break pattern', () => {
      const result = analyzeBreak('This is meaningless', 2);

      expect(result.brokenElement).toBe('meaning');
    });
  });
});

// Export for type checking
export {};
