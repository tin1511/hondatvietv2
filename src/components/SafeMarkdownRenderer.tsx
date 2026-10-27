import React from 'react';

interface SafeMarkdownRendererProps {
  content: string;
  className?: string;
}

// Pre-compiled static regular expressions - zero allocation per render
const INLINE_REGEX = /(\*\*.*?\*\*|\*[^*]+?\*|`[^`]+?`)/g;
const NUMBER_REGEX = /^(\d+)\.\s+(.*)$/;

/**
 * Fast helper to parse inline styles: bold (**text**), italic (*text*), code (`code`).
 * Has an O(1) early exit when no inline styling markers exist.
 */
function parseInline(text: string): React.ReactNode[] {
  // Fast path: 80%+ of text lines have no markdown asterisks or backticks
  if (!text.includes('*') && !text.includes('`')) {
    return [text];
  }

  const parts: React.ReactNode[] = [];
  INLINE_REGEX.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const matchText = match[0];
    if (matchText.startsWith('**') && matchText.endsWith('**')) {
      parts.push(
        <strong key={`b-${match.index}`} className="font-bold text-amber-200">
          {matchText.slice(2, -2)}
        </strong>
      );
    } else if (matchText.startsWith('*') && matchText.endsWith('*')) {
      parts.push(
        <em key={`i-${match.index}`} className="italic text-stone-300">
          {matchText.slice(1, -1)}
        </em>
      );
    } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
      parts.push(
        <code key={`c-${match.index}`} className="bg-stone-900 px-1 py-0.5 rounded text-amber-300 text-[11px] font-mono">
          {matchText.slice(1, -1)}
        </code>
      );
    }

    lastIndex = INLINE_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * High-performance, zero-dependency Markdown renderer for AI Chat streaming responses.
 * Parses headings, bullet points, numbered lists, bold, italics, blockquotes,
 * and horizontal rules without dangerouslySetInnerHTML or layout-thrashing DOM operations.
 */
export const SafeMarkdownRenderer: React.FC<SafeMarkdownRendererProps> = React.memo(({
  content,
  className = ''
}) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentListItems: React.ReactNode[] = [];
  let isNumberedList = false;
  let listKey = 0;

  const flushList = () => {
    if (currentListItems.length > 0) {
      if (isNumberedList) {
        elements.push(
          <ol key={`ol-${listKey++}`} className="list-decimal pl-5 my-2 space-y-1 text-inherit">
            {currentListItems}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${listKey++}`} className="list-disc pl-5 my-2 space-y-1 text-inherit">
            {currentListItems}
          </ul>
        );
      }
      currentListItems = [];
      isNumberedList = false;
    }
  };

  const len = lines.length;
  for (let index = 0; index < len; index++) {
    const line = lines[index];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      elements.push(<div key={`empty-${index}`} className="h-2" />);
      continue;
    }

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList();
      elements.push(
        <hr key={`hr-${index}`} className="my-3 border-stone-700/60" />
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${index}`} className="text-sm sm:text-base font-bold text-amber-300 mt-3 mb-1.5 flex items-center gap-1.5 font-serif">
          {parseInline(trimmed.substring(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${index}`} className="text-base sm:text-lg font-bold text-amber-400 mt-4 mb-2 font-serif">
          {parseInline(trimmed.substring(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${index}`} className="text-lg sm:text-xl font-bold text-amber-300 mt-4 mb-2 font-serif">
          {parseInline(trimmed.substring(2))}
        </h1>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={`quote-${index}`} className="border-l-2 border-amber-500/70 pl-3 py-1 my-2 italic text-stone-300 bg-stone-900/40 rounded-r">
          {parseInline(trimmed.substring(2))}
        </blockquote>
      );
      continue;
    }

    // Unordered List (* or -)
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      if (isNumberedList) flushList();
      isNumberedList = false;
      currentListItems.push(
        <li key={`li-${index}`} className="leading-relaxed">
          {parseInline(trimmed.substring(2))}
        </li>
      );
      continue;
    }

    // Numbered List (1. 2. etc.)
    const firstChar = trimmed[0];
    if (firstChar >= '0' && firstChar <= '9') {
      const numberMatch = trimmed.match(NUMBER_REGEX);
      if (numberMatch) {
        if (!isNumberedList && currentListItems.length > 0) flushList();
        isNumberedList = true;
        currentListItems.push(
          <li key={`li-${index}`} className="leading-relaxed">
            {parseInline(numberMatch[2])}
          </li>
        );
        continue;
      }
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${index}`} className="leading-relaxed my-1">
        {parseInline(line)}
      </p>
    );
  }

  flushList();

  return (
    <div className={`space-y-1 break-words text-stone-200 text-xs sm:text-sm ${className}`}>
      {elements}
    </div>
  );
});
