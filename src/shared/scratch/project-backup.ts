// Copies of the whole project for the chat's undo button: one taken when the kid sends a message,
// restored to undo that answer (and everything after it). vm.toJSON() names costumes and sounds only by
// asset id; library assets would load again from the Scratch CDN, but drawn, painted and edited ones
// exist only in memory (scratch-storage caches nothing it creates). So the backups remember every asset
// they have seen, and a storage helper hands those back while a project is restored.
import type { Asset, VirtualMachine } from './vm-types.ts';

export interface ProjectBackup {
  json: string;
  /** the sprite open in the editor, selected again after restoring */
  sprite?: string;
}

export interface ProjectBackups {
  save(): ProjectBackup;
  restore(backup: ProjectBackup): Promise<void>;
}

export const createProjectBackups = (vm: VirtualMachine): ProjectBackups => {
  // keyed by content hash, so a session keeps each asset once, shared with the live project
  const assets = new Map<string, Asset>();
  vm.runtime.storage.addHelper(
    {
      load: (_type, assetId) => {
        const asset = assets.get(assetId);
        return asset ? Promise.resolve(asset) : null;
      },
    },
    // before the built-in and web helpers: the CDN never has the drawn ones
    1000,
  );
  return {
    save: () => {
      for (const target of vm.runtime.targets) {
        if (!target.isOriginal) continue;
        for (const { asset } of [...target.getCostumes(), ...target.getSounds()]) {
          if (asset) assets.set(asset.assetId, asset);
        }
      }
      return { json: vm.toJSON(), sprite: vm.editingTarget?.getName() };
    },
    restore: async ({ json, sprite }) => {
      await vm.loadProject(json);
      const target = vm.runtime.targets.find((t) => t.isOriginal && t.getName() === sprite);
      if (target) vm.setEditingTarget(target.id);
    },
  };
};
