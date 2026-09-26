/**
 * Typed-judgment primitives.
 *
 * A judgment is a small, composable unit of machine opinion over a named
 * piece of state. Code owns the workflow: it builds state, asks narrow
 * questions, and combines the typed answers into decisions. The model
 * never decides by itself; it only fills the typed slots.
 */

/** A yes/no question answered with a probability P(true) in [0, 1]. */
export interface NoulQuestion {
  type: 'noul';
  /** What is being claimed. Must be answerable from `state` alone. */
  instructions: string;
  /** Meaning of each pole. Overlapping criteria produce mushy probabilities. */
  criteria: {
    true: string;
    false: string;
  };
}

export interface NoulAnswer {
  /** P(true), 0..1 */
  p: number;
  /** One-line reason, for auditability. Not part of the gate. */
  rationale?: string;
}

/** A pick-one question over a fixed set of options. */
export interface ChoiceQuestion {
  type: 'choice';
  instructions: string;
  options: string[];
}

export interface ChoiceAnswer {
  pick: string;
  /**
   * How peaked the choice is (margin of the winner), 0..1.
   * This measures distribution concentration, NOT overall correctness.
   */
  confidence: number;
  rationale?: string;
}

/** A position on an ordered set of levels. */
export interface ScoreQuestion {
  type: 'score';
  instructions: string;
  levels: string[];
}

export interface ScoreAnswer {
  level: string;
  /** Concentration around the chosen level, 0..1. */
  confidence: number;
  rationale?: string;
}

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export type AnswerMap = Record<string, NoulAnswer | ChoiceAnswer | ScoreAnswer>;

/** Named input the model may use. Keep it a flat record of named fields, not a blob. */
export type StateMap = Record<string, unknown>;

/** Code-owned verdict over a set of required judgments. */
export type GateVerdict = 'pass' | 'review' | 'fail';

export interface GateOptions {
  /** Required noul >= passAt counts as pass. Default 0.8. */
  passAt?: number;
  /** Required noul < failBelow fails outright. Default 0.5. */
  failBelow?: number;
}
