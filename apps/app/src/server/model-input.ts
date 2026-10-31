// Rebuilds the model input every turn instead of replaying the raw history:
// - earlier turns: what was said plus a one-line note of the tools that ran (no inputs/results, no
//   reasoning; their project state is outdated anyway). Without the note the model sees its own claims
//   ("I built it and highlighted the block") without evidence and "corrects" them as hallucinations.
//   If the kid undid the answer (metadata.undone), the note says so: the model must not build on it.
//   The note opens the kid's next message, as a note from the app: inside the model's own messages the
//   model copied it as text ("[Ausgeführte Werkzeuge: add_scripts]") instead of calling the tool.
// - the current user message carries the project snapshot taken when it was sent, so every step of
//   the turn has an identical (cacheable) prefix.
// - the current turn after that message: verbatim, because signed thinking blocks and tool results
//   must be passed back; only a step that did nothing but think (a call cut at max_tokens and asked
//   again, output-guard.ts) is left out: it would add its 16k thinking tokens to every later step.
// - turns the kids-protection guard answered (metadata.guard) are left out, the kid's message too:
//   blocked content never reaches the model.
// - a summary ("Zusammenfassen", compact.ts) replaced the conversation before it; the model gets it as
//   kid-side text, so the conversation still starts with a user message.
// Prompt caching (chat.ts): the earlier turns are byte-identical from one turn to the next, so they end
// with their own cache breakpoint and the next turn reads them instead of writing them again. One text
// block per earlier message keeps a turn's growth far inside the cache's 20-block lookback.
import type { ChatMessage } from '../shared/chat-types.ts';
import { repeatedTexts } from '../shared/repeated-text.ts';

const toolNote = (m: ChatMessage): string | undefined => {
  const tools = m.parts.flatMap((p) =>
    p.type.startsWith('tool-')
      ? [`${p.type.slice(5)}${'state' in p && p.state === 'output-error' ? ' (Fehler)' : ''}`]
      : [],
  );
  if (!tools.length) return undefined;
  const note = `Ausgeführte Werkzeuge: ${tools.join(', ')}`;
  return m.metadata?.undone ? `${note}. Das Kind hat diese Änderungen am Projekt rückgängig gemacht.` : note;
};

/** The note on the answer before a kid message, for the start of that message. */
const appNote = (previous: ChatMessage | undefined): string | undefined => {
  const note = previous?.role === 'assistant' ? toolNote(previous) : undefined;
  return note && `[Hinweis der App zu deiner letzten Antwort: ${note}]`;
};

/** What the answer said, without a text it repeated later (repeated-text.ts). */
const texts = (m: ChatMessage): string[] => {
  const all = m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : []));
  const repeated = repeatedTexts(all);
  return all.filter((_, i) => !repeated.has(i));
};

/** What was said, as one text part (none if nothing was said); `note` goes first. */
const oneText = (m: ChatMessage, note?: string): ChatMessage => {
  // an answer that only ran tools keeps its place in the conversation
  const said = texts(m).length || !toolNote(m) || note ? texts(m) : ['(nur Werkzeuge, kein Text)'];
  const text = [note, ...said].filter(Boolean).join('\n\n');
  return { ...m, parts: text ? [{ type: 'text', text }] : [] };
};

/** What was said plus the tool note, for a transcript (compact.ts). */
export const textOnly = (m: ChatMessage): ChatMessage => {
  const note = toolNote(m);
  return oneText(m, note && `[${note}]`);
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

/**
 * Drops the steps that only thought: no text, no tool call (a step also holds reasoning and the
 * provider's `custom` parts). Keeping one is not only waste: the API rejects the retry's thinking
 * behind it as modified, since it was signed without it.
 */
const withoutThoughtOnlySteps = (m: ChatMessage): ChatMessage => {
  const steps: ChatMessage['parts'][] = [];
  for (const p of m.parts) {
    if (p.type === 'step-start' || !steps.length) steps.push([]);
    steps.at(-1)?.push(p);
  }
  const kept = steps.filter((step) => step.some((p) => p.type === 'text' || p.type.startsWith('tool-')));
  return kept.length === steps.length || !kept.length ? m : { ...m, parts: kept.flat() };
};

export interface ModelInput {
  /** the earlier turns, text only: unchanged in every later turn */
  history: ChatMessage[];
  /** the current user message with its project snapshot, then the turn so far */
  turn: ChatMessage[];
}

export const buildModelInput = (all: ChatMessage[]): ModelInput => {
  const messages = withoutGuarded(all);
  const current = messages.findLastIndex((m) => m.role === 'user');
  const user = messages[current];
  if (!user) return { history: [], turn: messages };
  const history = messages
    .slice(0, current)
    .map((m, i) =>
      m.metadata?.summary ? summaryAsUser(m) : oneText(m, m.role === 'user' ? appNote(messages[i - 1]) : undefined),
    )
    .filter((m) => m.parts.length);
  const note = appNote(messages[current - 1]);
  const project = user.metadata?.project;
  const extra = [
    note,
    project && `<projekt>\n${project}\n</projekt>\n(Das ist der aktuelle Projektstand, get_project ist nicht nötig.)`,
  ].flatMap((text) => (text ? [{ type: 'text' as const, text }] : []));
  const userWithProject: ChatMessage = extra.length ? { ...user, parts: [...extra, ...user.parts] } : user;
  return { history, turn: [userWithProject, ...messages.slice(current + 1).map(withoutThoughtOnlySteps)] };
};

/** The 1-based number of the current turn (= user messages so far, including those a summary replaced). */
export const turnNumber = (messages: ChatMessage[]): number =>
  messages.reduce((n, m) => n + (m.role === 'user' ? 1 : (m.metadata?.turns ?? 0)), 0);
