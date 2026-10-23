// Runs the assistant's tool calls on the live VM, strictly one after another: tool calls change the
// VM and must never interleave, and a failed call must not fail the ones queued behind it.
import type { KiBridge } from '../../editor/bridge.ts';
import { createAssetTools } from '../../shared/tools/asset-tools.ts';
import { createProjectTools } from '../../shared/tools/project-tools.ts';
import { runTool, type ToolHandlers } from '../../shared/tools/tool-types.ts';
import { createUiToolHandlers } from './ui-tool-handlers.ts';

export type ToolRunner = (name: string, input: unknown) => Promise<unknown>;

export const createSerialRunner = (handlers: ToolHandlers): ToolRunner => {
  let queue: Promise<unknown> = Promise.resolve();
  return (name, input) => {
    const result = queue.then(() => runTool(handlers, name, input));
    queue = result.catch(() => {});
    return result;
  };
};

export const createToolRunner = (bridge: KiBridge): ToolRunner =>
  createSerialRunner({
    ...createProjectTools(bridge.vm, {
      cleanUp: () => bridge.uiGuide.cleanUpScripts(bridge.store),
      scriptsMissingInEditor: () => bridge.uiGuide.scriptsMissingInEditor(bridge.vm),
    }),
    ...createAssetTools(bridge.vm),
    ...createUiToolHandlers(bridge),
  });
