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
  /**
   * Judge calls set this to request the model's reasoning **for display** (SPEC
   * §5.4): the call sends `reasoning: { effort: JUDGE_REASONING_EFFORT }` and the
   * response's `message.reasoning` is captured. Overrides the global
   * `DISABLE_MODEL_REASONING` for this call. Advocates leave it unset (disabled).
   */
  captureReasoning?: boolean;
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
  /**
   * The model's own reasoning/thinking (`choices[0].message.reasoning`, SPEC
   * §5.4), captured when the call requested it (judge calls). `null` when
   * reasoning was disabled or the model returned none.
   */
  reasoning: string | null;
  usage: CallUsage;
  latencyMs: number;
  /**
   * Why generation stopped, from `choices[0].finish_reason`. `"length"` means
   * the reply was cut off at `max_tokens` (SPEC §5.6 truncation) — common on
   * free models' small caps. `null` when the provider omits it.
   */
  finishReason: string | null;
}

/** Minimal shape of OpenRouter's chat-completions response we read. */
export interface OpenRouterChatResponse {
  choices?: Array<{
    message?: { content?: string; reasoning?: string | null };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
}
