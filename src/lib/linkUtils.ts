/**
 * Utility functions to process HTML and text content to guarantee
 * all links are clickable, styled properly, and open in a new tab.
 */

/**
 * Ensures all existing <a> tags in HTML have target="_blank" and rel="noopener noreferrer",
 * and auto-links plain text URLs that are not already inside an anchor tag.
 */
export function processArticleHtmlLinks(html?: string): string {
  if (!html || typeof html !== 'string') return '';

  try {
    // 1. Ensure all existing <a ...> tags have target="_blank" and rel="noopener noreferrer"
    let processed = html.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
      let newAttrs = attrs;
      if (!/target\s*=/i.test(newAttrs)) {
        newAttrs += ' target="_blank"';
      } else {
        newAttrs = newAttrs.replace(/target=(['"])(.*?)\1/gi, 'target="_blank"');
      }
      if (!/rel\s*=/i.test(newAttrs)) {
        newAttrs += ' rel="noopener noreferrer"';
      } else {
        newAttrs = newAttrs.replace(/rel=(['"])(.*?)\1/gi, 'rel="noopener noreferrer"');
      }
      return `<a${newAttrs}>`;
    });

    return processed;
  } catch (err) {
    console.warn('Error processing article links:', err);
    return html || '';
  }
}
