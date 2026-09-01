/** Internal shapes for the OpenRouter chat wrapper (SPEC §5.4). Not part of the
 * cross-app contract — those live in @tribunal/shared-types. */

/** Inputs to a single persona call. */
export interface CallModelParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  /**
   * Optional correlation context for the diagnostic log (SPEC §5.7). Not sent to
   * OpenRouter — only tags the log entry so a call can be traced to its run/persona.
   */
  runId?: string;
  personaKey?: string;
}

/** Normalized usage read straight from OpenRouter's `usage` (SPEC §5.4). */
export interface CallUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Present only when the model reports it. */
  reasoningTokens: number | null;
  /** From `usage.cost` (USD; 0 for free models). Never estimated. */
  costUsd: number;
}

/** Result of one call. */
export interface CallModelResult {
  content: string;
  usage: CallUsage;
  latencyMs: number;
}

/** Minimal shape of OpenRouter's chat-completions response we read. */
export interface OpenRouterChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
}
