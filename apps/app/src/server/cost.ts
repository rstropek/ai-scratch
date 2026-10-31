// Anthropic token usage and its dollar cost (Claude Haiku 5.5 prices).

/** usage as reported by the Anthropic Messages API */
export interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/** $ per 1M tokens; cache writes cost 1.25x input, cache reads 0.1x input */
export const PRICE = { input: 0.1, output: 0.5 };

export const costOf = (u: AnthropicUsage): number =>
  ((u.input_tokens ?? 0) * PRICE.input +
    (u.cache_creation_input_tokens ?? 0) * PRICE.input * 1.25 +
    (u.cache_read_input_tokens ?? 0) * PRICE.input * 0.1 +
    (u.output_tokens ?? 0) * PRICE.output) /
  1e6;
