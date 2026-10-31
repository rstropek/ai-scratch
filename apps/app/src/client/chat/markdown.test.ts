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
      /<div><table>[\s\S]*<th>Block<\/th>[\s\S]*<td align="center">orange<\/td>/,
    );
    expect(renderMarkdown('Zeile 1\nZeile 2')).toBe('<p>Zeile 1<br>Zeile 2</p>\n');
  });

  test('raw HTML only shows as text; images and javascript: links are dropped', () => {
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
    const dom = document.createElement('div');
    dom.innerHTML = html;
    expect(dom.querySelectorAll('script, img, iframe, form, input, [style], [onclick], [onerror]')).toHaveLength(0);
    expect(dom.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(dom.textContent).toContain('<script>alert(1)</script>');
  });

  test('Scratch notation, checklists and indented lines keep their meaning', () => {
    expect(renderMarkdown('Nimm <mouse down?> und <b>')).toBe('<p>Nimm &lt;mouse down?&gt; und &lt;b&gt;</p>\n');
    expect(renderMarkdown('- [ ] Katze\n- [x] Hund')).toBe('<ul>\n<li>☐ Katze</li>\n<li>☑ Hund</li>\n</ul>\n');
    expect(renderMarkdown('Schritte:\n\n    wiederhole')).not.toContain('<pre>');
    expect(renderMarkdown('```\ncode\n```')).toContain('<pre><code>code');
  });

  test('links open in a new tab so the Scratch project in this tab survives', () => {
    expect(renderMarkdown('[Scratch](https://scratch.mit.edu)')).toBe(
      '<p><a href="https://scratch.mit.edu" target="_blank" rel="noopener noreferrer">Scratch</a></p>\n',
    );
    // a relative link would open a second, empty app: it stays text
    expect(renderMarkdown('[hier](/)')).not.toContain('href');
  });
});
