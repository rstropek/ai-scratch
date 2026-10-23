// The chat's undo button ("Rückgängig"): each kid message saves the project first
// (src/shared/scratch/project-backup.ts); undoing an answer restores the copy saved with the kid message
// before it. That also discards every later change, the kid's own included, so every later answer that
// changed the project counts as undone too.
import { getToolName, isToolUIPart } from 'ai';
import type { ChatMessage } from '../../shared/chat-types.ts';
import { PROJECT_CHANGING_TOOLS } from '../../shared/tools/index.ts';

export const changedProject = (m: ChatMessage): boolean =>
  m.role === 'assistant' &&
  m.parts.some((p) => isToolUIPart(p) && p.state === 'output-available' && PROJECT_CHANGING_TOOLS.has(getToolName(p)));

/** The kid message whose saved project undoes the answer at `index`. */
export const backupIdFor = (messages: ChatMessage[], index: number): string | undefined =>
  messages.slice(0, index).findLast((m) => m.role === 'user')?.id;

/** Marks the answer at `index` and every later one that changed the project as undone. */
export const markUndone = (messages: ChatMessage[], index: number): ChatMessage[] =>
  messages.map((m, i) =>
    i >= index && changedProject(m) && !m.metadata?.undone ? { ...m, metadata: { ...m.metadata, undone: true } } : m,
  );
