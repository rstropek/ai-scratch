// Drives the real chat like a kid: types a message, waits until the answer is done, and reads what came
// back. The answer text is read from the page (what the kid sees); the tool calls come from the request
// bodies the app sends (each /api/chat request carries the turn's tool results so far).
import type { Frame, Page, Request } from '@playwright/test';

export interface ToolCall {
  name: string;
  input: unknown;
  ok: boolean;
  error?: string;
}

export interface Answer {
  text: string;
  /** names of the library pictures the chat showed (what search_library found) */
  pictures?: string[];
  tools: ToolCall[];
  /** the chat showed an error instead of (or after) an answer */
  error?: string;
  /** wall-clock time of the turn */
  ms: number;
}

interface UiPart {
  type: string;
  text?: string;
  toolName?: string;
  input?: unknown;
  state?: string;
  errorText?: string;
}
interface UiMessage {
  role: string;
  parts: UiPart[];
}

const toolOf = (p: UiPart): ToolCall | undefined => {
  if (!p.type.startsWith('tool-') && p.type !== 'dynamic-tool') return undefined;
  return {
    name: p.toolName ?? p.type.slice('tool-'.length),
    input: p.input,
    ok: p.state === 'output-available',
    ...(p.errorText ? { error: p.errorText } : {}),
  };
};

export class ChatDriver {
  readonly page: Page;
  readonly editor: Frame;
  /** the X-Session-Id of this page: finds its calls in the research log */
  session = '';
  private requests: UiMessage[][] = [];

  private constructor(page: Page, editor: Frame) {
    this.page = page;
    this.editor = editor;
    page.on('request', (r: Request) => {
      if (!r.url().endsWith('/api/chat') || r.method() !== 'POST') return;
      this.session = r.headers()['x-session-id'] ?? this.session;
      const body = r.postDataJSON() as { messages?: UiMessage[] } | null;
      if (body?.messages) this.requests.push(body.messages);
    });
  }

  static async open(page: Page, baseUrl: string, code: string): Promise<ChatDriver> {
    await page.goto(`${baseUrl}/?code=${code}`);
    await page.getByPlaceholder(/Was soll ich bauen/).waitFor({ timeout: 60_000 });
    let editor: Frame | undefined;
    for (let i = 0; i < 300 && !editor; i++) {
      editor = page.frames().find((f) => /editor\.html/.test(f.url()));
      if (!editor) await page.waitForTimeout(100);
    }
    if (!editor) throw new Error('editor iframe missing');
    await editor.waitForFunction(() => (window.ki?.vm.runtime.targets.length ?? 0) > 1, undefined, { timeout: 60_000 });
    return new ChatDriver(page, editor);
  }

  private input = () => this.page.getByPlaceholder(/Was soll ich bauen/);
  private stop = () => this.page.getByRole('button', { name: 'Stopp', exact: true });

  /** Sends a kid message and waits for the whole answer (all tool calls included). */
  async send(text: string, timeoutMs = 10 * 60_000): Promise<Answer> {
    const started = Date.now();
    const before = await this.page.locator('[data-role="assistant"]').count();
    this.requests = [];
    await this.input().fill(text);
    await this.page.getByRole('button', { name: 'Senden', exact: true }).click();
    await this.stop()
      .waitFor({ timeout: 10_000 })
      .catch(() => undefined);
    await this.stop().waitFor({ state: 'hidden', timeout: timeoutMs });
    // the answer of this turn: the last assistant message, if a new one came
    const messages = this.page.locator('[data-role="assistant"]');
    const count = await messages.count();
    const answerText =
      count > before ? (await messages.last().getByTestId('assistant-text').allInnerTexts()).join('\n\n') : '';
    const pictures =
      count > before ? await messages.last().getByTestId('library-pictures').locator('figcaption').allInnerTexts() : [];
    const last = this.requests.at(-1)?.at(-1);
    const tools = last?.role === 'assistant' ? last.parts.flatMap((p) => toolOf(p) ?? []) : [];
    const alert = this.page.locator('[data-testid="messages"] [role="alert"]');
    const error = (await alert.count()) ? (await alert.last().textContent())?.trim() : undefined;
    return {
      text: answerText.trim(),
      ...(pictures.length ? { pictures } : {}),
      tools,
      ...(error ? { error } : {}),
      ms: Date.now() - started,
    };
  }

  /** "Zusammenfassen" when the memory gauge asks for it; returns whether it did. */
  async compactIfNeeded(): Promise<boolean> {
    const card = this.page.getByTestId('memory-card');
    if (!(await card.isVisible())) return false;
    await card.getByRole('button', { name: 'Zusammenfassen' }).click();
    await this.page.getByTestId('summary').waitFor({ timeout: 5 * 60_000 });
    return true;
  }

  /** The project as the kid would save it (Datei > Speichern). */
  async sb3(): Promise<Buffer> {
    const b64 = await this.editor.evaluate(async () => {
      const vm = window.ki?.vm;
      if (!vm) throw new Error('no VM');
      const blob = await vm.saveProjectSb3();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    });
    return Buffer.from(b64, 'base64');
  }

  async screenshot(): Promise<Buffer> {
    return this.page.screenshot();
  }
}
