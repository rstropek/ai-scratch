// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { renderMarkdown } from './markdown.ts';

describe('renderMarkdown', () => {
  test('renders the usual formatting: bold, code, lists, tables and line breaks', () => {
    expect(renderMarkdown('Klicke auf **Datei**, dann `.sb3`')).toBe(
      '<p>Klicke auf <strong>Datei</strong>, dann <code>.sb3</code></p>\n',
    );
    expect(renderMarkdown('1. eins\n2. zwei\n\n- a\n  - b')).toMatch(/<ol>\s*<li>eins<\/li>[\s\S]*<ul>[\s\S]*<ul>/);
    expect(renderMarkdown('| Block | Farbe |\n|---|:-:|\n| Steuerung | orange |')).toMatch(
      /<table>[\s\S]*<th>Block<\/th>[\s\S]*<td align="center">orange<\/td>/,
    );
    expect(renderMarkdown('Zeile 1\nZeile 2')).toBe('<p>Zeile 1<br>Zeile 2</p>\n');
  });

  test('drops scripts, event handlers, styles, images and dangerous links', () => {
    const html = renderMarkdown(
      [
        '<script>alert(1)</script>',
        '<img src=x onerror="alert(1)">',
        '<p onclick="alert(1)" style="color:red">hi</p>',
        '![bild](https://example.com/x.png)',
        '[klick](javascript:alert(1))',
        '<iframe src="https://example.com"></iframe>',
        '<form><input></form>',
      ].join('\n\n'),
    );
    expect(html).not.toMatch(/script|onerror|onclick|style=|<img|javascript:|<iframe|<form|<input/i);
    expect(html).toContain('hi');
  });

  test('links open in a new tab so the Scratch project in this tab survives', () => {
    expect(renderMarkdown('[Scratch](https://scratch.mit.edu)')).toBe(
      '<p><a href="https://scratch.mit.edu" target="_blank" rel="noopener noreferrer">Scratch</a></p>\n',
    );
  });
});
