// Tool definitions are plain JSON Schema (the server hands them to the model, the browser runs them).
// The wording and shapes were measured in the prototype's eval; change them deliberately.

export interface JsonSchemaObject {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchemaObject;
}

export type ToolArgs = Record<string, unknown>;
export type ToolHandler = (args: ToolArgs) => unknown;
/** Executors by tool name; families are merged with object spread. */
export type ToolHandlers = Record<string, ToolHandler>;

export const fn = (
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
): ToolDefinition => ({ name, description, parameters: { type: 'object', properties, required } });

/** Reads a required string argument; the message goes back to the model, so it says what to fix. */
export const stringArg = (args: ToolArgs, key: string): string => {
  const value = args[key];
  if (typeof value !== 'string' || !value) throw new Error(`"${key}" must be a non-empty string`);
  return value;
};

export const optionalStringArg = (args: ToolArgs, key: string): string | undefined => {
  const value = args[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`"${key}" must be a string`);
  return value;
};

/** Models occasionally send a nested argument as a JSON string instead of JSON. */
export const jsonArg = (args: ToolArgs, key: string): unknown => {
  const value = args[key];
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`"${key}" is not valid JSON`);
  }
};

export const runTool = async (handlers: ToolHandlers, name: string, args: unknown): Promise<unknown> => {
  const handler = Object.hasOwn(handlers, name) ? handlers[name] : undefined;
  if (!handler) throw new Error(`Unknown tool ${name}`);
  const toolArgs = typeof args === 'object' && args !== null && !Array.isArray(args) ? (args as ToolArgs) : {};
  return handler(toolArgs);
};
