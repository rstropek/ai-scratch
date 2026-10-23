// Builds Anthropic Messages API streaming responses for server tests (no network, no cost).

export interface FakeTurn {
  thinking?: string;
  text?: string;
  toolCall?: { id: string; name: string; input: unknown };
  usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
}

export const anthropicSse = ({ thinking, text, toolCall, usage }: FakeTurn): string => {
  const u = usage ?? { input_tokens: 1000, output_tokens: 50, cache_read_input_tokens: 0 };
  const events: object[] = [
    {
      type: 'message_start',
      message: {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-5-5',
        content: [],
        stop_reason: null,
        usage: {
          input_tokens: u.input_tokens,
          output_tokens: 1,
          cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
        },
      },
    },
  ];
  let index = 0;
  if (thinking) {
    events.push(
      { type: 'content_block_start', index, content_block: { type: 'thinking', thinking: '', signature: '' } },
      { type: 'content_block_delta', index, delta: { type: 'thinking_delta', thinking } },
      { type: 'content_block_delta', index, delta: { type: 'signature_delta', signature: 'sig' } },
      { type: 'content_block_stop', index },
    );
    index++;
  }
  if (text) {
    events.push(
      { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index, delta: { type: 'text_delta', text } },
      { type: 'content_block_stop', index },
    );
    index++;
  }
  if (toolCall) {
    const json = JSON.stringify(toolCall.input);
    events.push(
      {
        type: 'content_block_start',
        index,
        content_block: { type: 'tool_use', id: toolCall.id, name: toolCall.name, input: {} },
      },
      { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: json.slice(0, 5) } },
      { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: json.slice(5) } },
      { type: 'content_block_stop', index },
    );
  }
  events.push(
    {
      type: 'message_delta',
      delta: { stop_reason: toolCall ? 'tool_use' : 'end_turn' },
      usage: { output_tokens: u.output_tokens },
    },
    { type: 'message_stop' },
  );
  return events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
};

export const sseResponse = (body: string): Response =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
