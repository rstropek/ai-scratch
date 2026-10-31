// Messages exchanged between the chat UI (useChat) and /api/chat.
import type { LanguageModelUsage, UIMessage } from 'ai';

/** Why the kids-protection guard answered a message itself instead of the model (src/server/guard.ts). */
export type GuardCategory = 'distress' | 'inappropriate' | 'personal_data' | 'misuse' | 'too_long';

export interface ChatMetadata {
  /** user messages: the project snapshot (JSON) taken when the kid sent the message */
  project?: string;
  /** assistant messages: token usage of the whole turn */
  usage?: LanguageModelUsage;
  /** assistant messages: the guard's fixed answer; this turn is left out of later model input */
  guard?: GuardCategory;
  /** assistant messages: the context the model read at the start of this turn, in tokens (energy.ts) */
  context?: number;
  /** assistant messages: the AI's summary that replaced the conversation before it ("Zusammenfassen") */
  summary?: true;
  /** summaries: how many kid turns the summary replaced, so turn numbers in the research log keep counting */
  turns?: number;
  /** assistant messages: the kid undid this answer's changes to the project (the chat's undo button) */
  undone?: true;
}

export type ChatMessage = UIMessage<ChatMetadata>;

export const ACCESS_CODE_HEADER = 'X-Access-Code';
export const SESSION_HEADER = 'X-Session-Id';
