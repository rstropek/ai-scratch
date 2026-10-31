// Executors of the "show, don't do" tools (definitions: src/shared/tools/ui-tools.ts). They drive the
// editor through the ui-guide instance living in the editor iframe, which draws into that document.
import type { KiBridge } from '../../editor/bridge.ts';
import { optionalStringArg, stringArg, type ToolHandlers } from '../../shared/tools/tool-types.ts';

export const createUiToolHandlers = ({ vm, store, uiGuide }: KiBridge): ToolHandlers => {
  const label = (args: Record<string, unknown>) => optionalStringArg(args, 'label') ?? 'Hier!';
  return {
    show_sprite: (args) => {
      uiGuide.selectTarget(vm, stringArg(args, 'sprite'));
      return { ok: true };
    },
    show_tab: (args) => {
      uiGuide.openTab(store, stringArg(args, 'tab'));
      return { ok: true };
    },
    point_to_palette_block: async (args) => {
      uiGuide.openTab(store, 'code');
      await uiGuide.pointAtPaletteBlock(stringArg(args, 'opcode'), label(args));
      return { ok: true };
    },
    point_to_script_block: async (args) => {
      const sprite = optionalStringArg(args, 'sprite');
      if (sprite) uiGuide.selectTarget(vm, sprite);
      uiGuide.openTab(store, 'code');
      const nth = typeof args.nth === 'number' && args.nth >= 1 ? Math.floor(args.nth) : 1;
      await uiGuide.pointAtScriptBlock(stringArg(args, 'opcode'), label(args), nth, vm.editingTarget);
      return { ok: true };
    },
    point_to_ui_element: async (args) => {
      const element = stringArg(args, 'element');
      if (element === 'category') uiGuide.openTab(store, 'code');
      await uiGuide.pointAtUiElement(element, label(args), optionalStringArg(args, 'name'));
      return { ok: true };
    },
  };
};
