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
}

export type ChatMessage = UIMessage<ChatMetadata>;

export const ACCESS_CODE_HEADER = 'X-Access-Code';
export const SESSION_HEADER = 'X-Session-Id';
