// The assistant's full tool set: definitions + instructions (server) and the names of the tool
// families whose executors run in the browser on the live VM.
import { SYSTEM_PROMPT } from '../prompt.ts';
import { assetToolDefinitions, assetToolsPrompt } from './asset-tools.ts';
import { projectToolDefinitions, projectToolsPrompt } from './project-tools.ts';
import type { ToolDefinition } from './tool-types.ts';
import { uiToolDefinitions, uiToolsPrompt } from './ui-tools.ts';

export const toolDefinitions: ToolDefinition[] = [
  ...projectToolDefinitions,
  ...uiToolDefinitions,
  ...assetToolDefinitions,
];

/** System prompt + tool instructions: static, so Anthropic can cache it. */
export const buildInstructions = (): string =>
  `${SYSTEM_PROMPT}\n${projectToolsPrompt()}\n${uiToolsPrompt}\n${assetToolsPrompt}`;
