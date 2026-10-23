// Layout: chat on the left, the unmodified Scratch editor in a same-origin iframe on the right
// (the iframe isolates Scratch's global CSS from Tailwind and lets the editor mount exactly once).
import { useEffect, useMemo, useRef } from 'react';
import { ChatPanel } from './chat/ChatPanel.tsx';
import { createToolRunner } from './scratch/tool-runner.ts';
import { useScratchBridge } from './scratch/use-scratch-bridge.ts';

const accessCode = new URLSearchParams(location.search).get('code') ?? '';
const sessionId = crypto.randomUUID();

export const App = () => {
  const iframe = useRef<HTMLIFrameElement>(null);
  const bridge = useScratchBridge(iframe);
  const runTool = useMemo(() => (bridge ? createToolRunner(bridge) : undefined), [bridge]);

  // Warn before closing/reloading the tab: the Scratch project only lives in this tab.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, []);

  return (
    <div className="grid h-full grid-cols-[380px_1fr]">
      <ChatPanel accessCode={accessCode} sessionId={sessionId} runTool={runTool} />
      <iframe ref={iframe} src="/editor.html" title="Scratch" className="h-full w-full border-0" />
    </div>
  );
};
