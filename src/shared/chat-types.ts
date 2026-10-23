// Messages exchanged between the chat UI (useChat) and /api/chat.
import type { LanguageModelUsage, UIMessage } from 'ai';

export interface ChatMetadata {
  /** user messages: the project snapshot (JSON) taken when the kid sent the message */
  project?: string;
  /** assistant messages: token usage of the whole turn */
  usage?: LanguageModelUsage;
}

export type ChatMessage = UIMessage<ChatMetadata>;

export const ACCESS_CODE_HEADER = 'X-Access-Code';
export const SESSION_HEADER = 'X-Session-Id';
