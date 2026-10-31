// Waits for the editor iframe to expose window.ki (the VM exists only after Scratch has loaded).
import { type RefObject, useEffect, useState } from 'react';
import type { KiBridge } from '../../editor/bridge.ts';

export const useScratchBridge = (iframe: RefObject<HTMLIFrameElement | null>): KiBridge | undefined => {
  const [bridge, setBridge] = useState<KiBridge>();
  useEffect(() => {
    const timer = setInterval(() => {
      const ki = iframe.current?.contentWindow?.ki;
      if (ki?.vm) {
        clearInterval(timer);
        setBridge(ki);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [iframe]);
  return bridge;
};
