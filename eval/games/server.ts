// The app server for a harness run: the production build (npm run build), started with the harness's own
// access code (an admin_ code: no hearts), the model and prompt under test, and its research log in the
// run directory. Never the Azure Blob log: eval sessions must not mix with the kids' research data.
import { type ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';

export const EVAL_CODE = 'admin_eval';

export interface ServerOptions {
  port: number;
  logDir: string;
  model?: string;
  effort?: string;
  instructionsFile?: string;
}

export interface RunningServer {
  url: string;
  stop(): Promise<void>;
}

export const startServer = async ({
  port,
  logDir,
  model,
  effort,
  instructionsFile,
}: ServerOptions): Promise<RunningServer> => {
  if (!fs.existsSync('dist/client/index.html')) throw new Error('No production build: run `npm run build` first');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    ACCESS_CODES: EVAL_CODE,
    LOG_DIR: logDir,
    LOG_BLOB_URL: '',
    ...(model ? { MODEL: model } : {}),
    ...(effort ? { EFFORT: effort } : {}),
    ...(instructionsFile ? { INSTRUCTIONS_FILE: instructionsFile } : {}),
  };
  const child: ChildProcess = spawn(process.execPath, ['src/server/main.ts'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output: string[] = [];
  child.stdout?.on('data', (d) => output.push(String(d)));
  child.stderr?.on('data', (d) => output.push(String(d)));
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited:\n${output.join('')}`);
    const ok = await fetch(`${url}/healthz`)
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) {
      return {
        url,
        stop: () =>
          new Promise((resolve) => {
            child.once('exit', () => resolve());
            child.kill('SIGTERM');
          }),
      };
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`Server did not start:\n${output.join('')}`);
};
