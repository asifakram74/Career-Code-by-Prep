import React from 'react';
import { ExternalLink } from 'lucide-react';

interface LinkifiedTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
  isMe?: boolean;
}

/**
 * Parses raw text and converts URLs and Markdown-style links into
 * clickable anchor tags that open securely in a new tab (target="_blank" rel="noopener noreferrer").
 */
export const LinkifiedText: React.FC<LinkifiedTextProps> = ({
  text,
  className = '',
  linkClassName,
  isMe = false,
}) => {
  if (!text) return null;

  // Combined Regex for:
  // 1) Markdown links: [Title](https://...)
  // 2) Standard URLs: https://... or http://... or www....
  const combinedRegex =
    /(\[[^\]]+\]\(https?:\/\/[^\s)]+\))|((?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;"')\]>])/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Default color schemes based on bubble context
  const defaultLinkClass = isMe
    ? 'text-emerald-900 hover:text-emerald-950 underline decoration-emerald-600/70 font-semibold break-all inline-flex items-center gap-0.5 hover:decoration-emerald-900 transition-colors cursor-pointer'
    : 'text-pink-600 hover:text-pink-800 underline decoration-pink-400 font-semibold break-all inline-flex items-center gap-0.5 hover:decoration-pink-700 transition-colors cursor-pointer';

  const finalLinkClass = linkClassName || defaultLinkClass;

  while ((match = combinedRegex.exec(text)) !== null) {
    const matchIndex = match.index;

    // Push text preceding the matched URL
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    const matchedString = match[0];

    // Case 1: Markdown link [Label](url)
    if (matchedString.startsWith('[') && matchedString.includes('](')) {
      const mdMatch = matchedString.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      if (mdMatch) {
        const [, label, url] = mdMatch;
        parts.push(
          <a
            key={`md-link-${matchIndex}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={finalLinkClass}
            title={`Open ${url} in a new tab`}
          >
            <span>{label}</span>
            <ExternalLink className="w-3 h-3 shrink-0 inline-block opacity-80" />
          </a>
        );
      } else {
        parts.push(matchedString);
      }
    } else {
      // Case 2: Plain URL (https://..., http://..., or www....)
      let url = matchedString;
      let displayUrl = matchedString;

      // Handle trailing punctuation that was matched
      const trailingPunctuationMatch = url.match(/[.,;:!?)]+$/);
      let trailingPunctuation = '';
      if (trailingPunctuationMatch) {
        trailingPunctuation = trailingPunctuationMatch[0];
        url = url.slice(0, -trailingPunctuation.length);
        displayUrl = url;
      }

      const href = url.startsWith('www.') ? `https://${url}` : url;

      parts.push(
        <React.Fragment key={`url-${matchIndex}`}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={finalLinkClass}
            title={`Open ${href} in a new tab`}
          >
            <span>{displayUrl}</span>
            <ExternalLink className="w-3 h-3 shrink-0 inline-block opacity-80" />
          </a>
          {trailingPunctuation}
        </React.Fragment>
      );
    }

    lastIndex = matchIndex + matchedString.length;
  }

  // Push remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <span className={className}>{parts}</span>;
};
