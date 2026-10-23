// Rebuilds the model input every turn instead of replaying the raw history:
// - earlier turns: what was said plus a one-line note of the tools that ran (no inputs/results, no
//   reasoning; their project state is outdated anyway). Without the note the model sees its own claims
//   ("I built it and highlighted the block") without evidence and "corrects" them as hallucinations.
// - the current user message carries the project snapshot taken when it was sent, so every step of
//   the turn has an identical (cacheable) prefix.
// - the current turn after that message: verbatim, because signed thinking blocks and tool results
//   must be passed back.
// - turns the kids-protection guard answered (metadata.guard) are left out, the kid's message too:
//   blocked content never reaches the model.
// - a summary ("Zusammenfassen", compact.ts) replaced the conversation before it; the model gets it as
//   kid-side text, so the conversation still starts with a user message.
import type { ChatMessage } from '../shared/chat-types.ts';

const toolNote = (m: ChatMessage): string | undefined => {
  const tools = m.parts.flatMap((p) =>
    p.type.startsWith('tool-')
      ? [`${p.type.slice(5)}${'state' in p && p.state === 'output-error' ? ' (Fehler)' : ''}`]
      : [],
  );
  return tools.length ? `[Ausgeführte Werkzeuge: ${tools.join(', ')}]` : undefined;
};

export const textOnly = (m: ChatMessage): ChatMessage => {
  const note = toolNote(m);
  const texts = m.parts.filter((p) => p.type === 'text');
  return { ...m, parts: note ? [{ type: 'text', text: note }, ...texts] : texts };
};

/** Drops each guard answer and the kid message it answered. */
export const withoutGuarded = (messages: ChatMessage[]): ChatMessage[] =>
  messages.filter((m, i) => !m.metadata?.guard && !messages[i + 1]?.metadata?.guard);

export const SUMMARY_HEADING = '[Zusammenfassung des bisherigen Gesprächs]';

const summaryAsUser = (m: ChatMessage): ChatMessage => ({
  ...m,
  role: 'user',
  parts: [{ type: 'text', text: SUMMARY_HEADING }, ...m.parts.filter((p) => p.type === 'text')],
});

export const buildModelInput = (all: ChatMessage[]): ChatMessage[] => {
  const messages = withoutGuarded(all);
  const current = messages.findLastIndex((m) => m.role === 'user');
  const user = messages[current];
  if (!user) return messages;
  const earlier = messages
    .slice(0, current)
    .map((m) => (m.metadata?.summary ? summaryAsUser(m) : textOnly(m)))
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
