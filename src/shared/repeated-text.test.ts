import { describe, expect, test } from 'vitest';
import { repeatedTexts } from './repeated-text.ts';

describe('repeatedTexts', () => {
  const said = 'Ich habe das Skript **Unentschieden** auf die Bühne gesetzt.\n\nTeste es mit diesen Zügen.';

  test('an explanation repeated after a tool call is shown once, the longer copy wins', () => {
    expect(repeatedTexts([said, `${said}\n\nErscheint danach \`Unentschieden!\`?`])).toEqual(new Set([0]));
    expect(repeatedTexts([said, said.replace('\n\n', ' ')])).toEqual(new Set([0]));
  });

  test('while the repeat streams, the earlier copy stays and the partial one is hidden', () => {
    expect(repeatedTexts([said, 'Ich habe das Skript **Unent'])).toEqual(new Set([1]));
  });

  test('different texts all stay', () => {
    expect(repeatedTexts(['Ich baue jetzt das Skript.', 'Fertig! Klick auf die grüne Flagge.', ''])).toEqual(new Set());
    expect(repeatedTexts(['Okay.', 'Okay. Jetzt teste es.'])).toEqual(new Set()); // too short to call it a repeat
  });
});
