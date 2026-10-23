// Rebuilds the model input every turn instead of replaying the raw history:
// - earlier turns: what was said plus a one-line note of the tools that ran (no inputs/results, no
//   reasoning; their project state is outdated anyway). Without the note the model sees its own claims
//   ("I built it and highlighted the block") without evidence and "corrects" them as hallucinations.
// - the current user message carries the project snapshot taken when it was sent, so every step of
//   the turn has an identical (cacheable) prefix.
// - the current turn after that message: verbatim, because signed thinking blocks and tool results
//   must be passed back.
import type { ChatMessage } from '../shared/chat-types.ts';

const toolNote = (m: ChatMessage): string | undefined => {
  const tools = m.parts.flatMap((p) =>
    p.type.startsWith('tool-')
      ? [`${p.type.slice(5)}${'state' in p && p.state === 'output-error' ? ' (Fehler)' : ''}`]
      : [],
  );
  return tools.length ? `[Ausgeführte Werkzeuge: ${tools.join(', ')}]` : undefined;
};

const textOnly = (m: ChatMessage): ChatMessage => {
  const note = toolNote(m);
  const texts = m.parts.filter((p) => p.type === 'text');
  return { ...m, parts: note ? [{ type: 'text', text: note }, ...texts] : texts };
};

export const buildModelInput = (messages: ChatMessage[]): ChatMessage[] => {
  const current = messages.findLastIndex((m) => m.role === 'user');
  const user = messages[current];
  if (!user) return messages;
  const earlier = messages
    .slice(0, current)
    .map(textOnly)
    .filter((m) => m.parts.length);
  const project = user.metadata?.project;
  const userWithProject: ChatMessage = project
    ? {
        ...user,
        parts: [
          {
            type: 'text',
            text: `<projekt>\n${project}\n</projekt>\n(Das ist der aktuelle Projektstand, get_project ist nicht nötig.)`,
          },
          ...user.parts,
        ],
      }
    : user;
  return [...earlier, userWithProject, ...messages.slice(current + 1)];
};

/** The 1-based number of the current turn (= user messages so far). */
export const turnNumber = (messages: ChatMessage[]): number => messages.filter((m) => m.role === 'user').length;
