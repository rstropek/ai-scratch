// Tool inputs the model got wrong. Haiku's long add_scripts inputs often have one bracket too many
// (`}}}}]` for `}}}]`, `]]]}` at the end): repairBrackets fixes exactly that. Anything else gets an error
// that shows where it broke; the AI SDK's own message repeats the whole input (several thousand
// characters) without saying where, and Haiku resent the same broken JSON three times in a row.
import { InvalidToolInputError, JSONParseError, type ToolCallRepairFunction, type ToolSet } from 'ai';

const MAX_TEXT = 600;

/** What broke in a tool input that isn't JSON, from the error or (on some paths) only its message. */
const brokenJson = (e: unknown): { toolName: string; text: string; reason: string } | undefined => {
  if (InvalidToolInputError.isInstance(e) && JSONParseError.isInstance(e.cause)) {
    const why = e.cause.cause;
    return { toolName: e.toolName, text: e.cause.text, reason: why instanceof Error ? why.message : String(why) };
  }
  // the AI SDK sometimes hands over the error already turned into its message
  const message = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
  const m = message.match(
    /Invalid input for tool (\w+): (?:AI_JSONParseError: )?JSON parsing failed: Text: ([\s\S]*)\.\nError message: ([\s\S]*)$/,
  );
  return m ? { toolName: m[1] as string, text: m[2] as string, reason: m[3] as string } : undefined;
};

/** The error text for a failed request or tool call, as the next model call reads it. */
export const toolErrorText = (e: unknown): string => {
  const broken = brokenJson(e);
  if (broken) {
    const { toolName, text, reason } = broken;
    const at = Number(reason.match(/position (\d+)/)?.[1]);
    const where = Number.isNaN(at)
      ? ''
      : ` It broke here (at ⟪HERE⟫): "${text.slice(Math.max(0, at - 120), at)}⟪HERE⟫${text.slice(at, at + 40)}".`;
    return (
      `Not run: the input of ${toolName} is not valid JSON (${reason.replace(/^SyntaxError: /, '')}).${where} ` +
      'Usually a bracket closes the wrong thing: count the { } and [ ] before that point. ' +
      'Send long scripts as several add_scripts calls, one script each.'
    );
  }
  if (InvalidToolInputError.isInstance(e)) {
    const why = e.cause instanceof Error ? e.cause.message : String(e.cause);
    return `Not run: the input of ${e.toolName} does not match its schema: ${why.slice(0, MAX_TEXT)}`;
  }
  return e instanceof Error ? e.message : String(e);
};

const CLOSER: Record<string, string> = { '}': '{', ']': '[' };
/** At most this many brackets are dropped or added; more means the structure itself is unclear. */
const MAX_FIXES = 2;

/**
 * Drops closing brackets that don't match the open one and closes what is still open at the end. Within
 * a run of closers it doesn't matter which one is dropped, so the result is what the model meant, and
 * the script compiler still checks every block. Undefined if it isn't that kind of mistake.
 */
export const repairBrackets = (text: string): string | undefined => {
  const open: string[] = [];
  let out = '';
  let fixes = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (inString) {
      if (c === '\\') {
        out += c + (text[i + 1] ?? '');
        i++;
        continue;
      }
      if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{' || c === '[') open.push(c);
    else if (c in CLOSER) {
      if (open.at(-1) !== CLOSER[c]) {
        fixes++;
        continue;
      }
      open.pop();
    }
    out += c;
  }
  if (inString) return undefined;
  fixes += open.length;
  out += open
    .reverse()
    .map((c) => (c === '{' ? '}' : ']'))
    .join('');
  if (fixes === 0 || fixes > MAX_FIXES) return undefined;
  try {
    JSON.parse(out);
    return out;
  } catch {
    return undefined;
  }
};

/** streamText's repairToolCall: broken brackets in a tool input are fixed, the rest stays an error. */
export const repairToolInput: ToolCallRepairFunction<ToolSet> = async ({ toolCall, error }) => {
  if (!InvalidToolInputError.isInstance(error) || !JSONParseError.isInstance(error.cause)) return null;
  const input = repairBrackets(toolCall.input);
  return input === undefined ? null : { ...toolCall, input };
};
