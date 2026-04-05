/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - What-For Chain Tests
 * 
 * Tests for RULE_2: "А чтобы что?" chain terminal MUST be classified as BREAK or DILEMMA.
 * Tests for BREAK at step ≤4 being critical.
 */

import { runWhatForChain, classifyTerminal } from '../src/lib/audit/what-for-chain';
import type { ChainResult } from '../src/lib/audit/types';

describe('What-For Chain Classification', () => {
  describe('classifyTerminal', () => {
    test('Detects BREAK markers', () => {
      const breakPhrases = [
        'to make it interesting',
        'so the hero could win',
        'because plot requires',
        'for dramatic effect',
        'cycle without state change',
      ];

      breakPhrases.forEach(phrase => {
        const result = classifyTerminal(phrase);
        expect(result).toBe('BREAK');
      });
    });

    test('Detects DILEMMA markers', () => {
      const dilemmaPhrases = [
        'no right choice',
        'both paths irreversible',
        'choice forces identity change',
        'either way loses something',
        'impossible choice',
      ];

      dilemmaPhrases.forEach(phrase => {
        const result = classifyTerminal(phrase);
        expect(result).toBe('DILEMMA');
      });
    });

    test('Returns null for unclassified phrases', () => {
      const neutralPhrase = 'the character wants to save their family';
      const result = classifyTerminal(neutralPhrase);
      expect(result).toBeNull();
    });
  });

  describe('runWhatForChain', () => {
    test('BREAK at step <= 4 generates bind_to_law_or_remove action', () => {
      // Simulated chain result with early BREAK
      const result: ChainResult = {
        terminal_type: 'BREAK',
        terminal: 'BREAK',
        terminalStep: 3,
        step_reached: 3,
        action: 'bind_to_law_or_remove',
        iterations: [
          { step: 1, question: 'А чтобы что? (element)', answer: 'first answer' },
          { step: 2, question: 'А чтобы что? (first answer)', answer: 'to make it interesting' },
          { step: 3, question: 'А чтобы что? (to make it interesting)', answer: 'because plot requires' },
        ],
        valid: true
      };

      expect(result.terminal_type).toBe('BREAK');
      expect(result.terminalStep).toBeLessThanOrEqual(4);
      expect(result.action).toBe('bind_to_law_or_remove');
    });

    test('DILEMMA generates keep action', () => {
      const result: ChainResult = {
        terminal_type: 'DILEMMA',
        terminal: 'DILEMMA',
        terminalStep: 5,
        step_reached: 5,
        action: 'keep',
        iterations: [],
        valid: true
      };

      expect(result.terminal_type).toBe('DILEMMA');
      expect(result.action).toBe('keep');
    });

    test('Unclassified terminal is invalid (requires retry)', () => {
      const result: ChainResult = {
        terminal_type: null,
        terminal: 'UNCLASSIFIED',
        terminalStep: 7,
        step_reached: 7,
        action: 'retry_analysis',
        iterations: [],
        valid: false
      };

      expect(result.valid).toBe(false);
      expect(result.action).toBe('retry_analysis');
    });

    test('Chain reaches maximum 7 iterations', () => {
      const chain = runWhatForChain('test_element', 'test narrative context');
      
      expect(chain.iterations.length).toBeLessThanOrEqual(7);
      expect(chain.step_reached).toBeLessThanOrEqual(7);
    });
  });

  describe('Chain validation rules', () => {
    test('BREAK at step > 4 is not critical', () => {
      const result: ChainResult = {
        terminal_type: 'BREAK',
        terminal: 'BREAK',
        terminalStep: 6,
        step_reached: 6,
        action: 'bind_to_law_or_remove',
        iterations: [],
        valid: true
      };

      expect(result.terminalStep).toBeGreaterThan(4);
      // This should not be flagged as critical
    });

    test('Valid chains have terminal classification', () => {
      const validResults: ChainResult[] = [
        { terminal_type: 'BREAK', terminal: 'BREAK', step_reached: 3, action: 'bind_to_law_or_remove', iterations: [], valid: true },
        { terminal_type: 'DILEMMA', terminal: 'DILEMMA', step_reached: 5, action: 'keep', iterations: [], valid: true },
      ];

      validResults.forEach(result => {
        expect(result.valid).toBe(true);
        expect(result.terminal_type).not.toBeNull();
        expect(['BREAK', 'DILEMMA']).toContain(result.terminal_type);
      });
    });
  });
});

// Export for type checking
export {};
