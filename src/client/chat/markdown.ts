// The assistant answers in Markdown (bold block names, lists of steps, now and then a table).
// marked turns it into HTML, DOMPurify then keeps only plain formatting: no images, forms, styles
// or scripts. Links open in a new tab, so a click never navigates away from the Scratch project,
// which only lives in this tab.
import DOMPurify from 'dompurify';
import { Marked } from 'marked';

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

// breaks: a single newline is a line break, as the model and the old plain-text bubble meant it
const marked = new Marked({ gfm: true, breaks: true }).use({
  // Raw HTML is shown as text: Scratch writes boolean blocks as <mouse down?>, which would
  // otherwise be parsed as a tag and silently dropped.
  renderer: {
    html: ({ text }) => escapeHtml(text),
    checkbox: ({ checked }) => (checked ? '☑ ' : '☐ '),
  },
  // Indented lines are nesting the model means visually, not a code block (fences still work).
  tokenizer: { code: () => undefined },
  // wide tables scroll in their own box (see .markdown in index.css)
  hooks: { postprocess: (html) => html.replaceAll('<table>', '<div><table>').replaceAll('</table>', '</table></div>') },
});

const purify = DOMPurify(window);
purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName !== 'A') return;
  // only absolute web links: a relative one like "/" would open a second, empty app
  if (!/^(?:https?:\/\/|mailto:)/i.test(node.getAttribute('href') ?? '')) node.removeAttribute('href');
  node.setAttribute('target', '_blank');
  node.setAttribute('rel', 'noopener noreferrer');
});

const ALLOWED_TAGS =
  'p br hr h1 h2 h3 h4 h5 h6 strong b em i del s code pre blockquote a ul ol li div table thead tbody tr th td'.split(
    ' ',
  );

/** Markdown to sanitized HTML, safe for `dangerouslySetInnerHTML`. */
export const renderMarkdown = (text: string): string =>
  purify.sanitize(marked.parse(text, { async: false }), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'start', 'align'],
  });
