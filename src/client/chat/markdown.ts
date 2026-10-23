// The assistant answers in Markdown (bold block names, lists of steps, now and then a table).
// marked turns it into HTML, DOMPurify then keeps only plain formatting: no images, forms, styles
// or scripts, even if the model writes raw HTML. Links open in a new tab, so a click never
// navigates away from the Scratch project, which only lives in this tab.
import DOMPurify from 'dompurify';
import { Marked } from 'marked';

// breaks: a single newline is a line break, as the model and the old plain-text bubble meant it
const marked = new Marked({ gfm: true, breaks: true });

const purify = DOMPurify(window);
purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const ALLOWED_TAGS =
  'p br hr h1 h2 h3 h4 h5 h6 strong b em i del s code pre blockquote a ul ol li table thead tbody tr th td'.split(' ');

/** Markdown to sanitized HTML, safe for `dangerouslySetInnerHTML`. */
export const renderMarkdown = (text: string): string =>
  purify.sanitize(marked.parse(text, { async: false }), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'start', 'align'],
  });
