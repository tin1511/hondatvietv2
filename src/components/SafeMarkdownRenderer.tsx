import React from 'react';

interface SafeMarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Safe, zero-dependency Markdown renderer for AI Chat responses.
 * Parses headings, bullet points, numbered lists, bold, italics, blockquotes,
 * and horizontal rules without using dangerouslySetInnerHTML.
 */
export const SafeMarkdownRenderer: React.FC<SafeMarkdownRendererProps> = ({
  content,
  className = ''
}) => {
  if (!content) return null;

  // Split content into lines for block-level parsing
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

  // Helper to parse inline styles: bold (**text**), italic (*text*), code (`code`)
  const parseInline = (text: string): React.ReactNode[] => {
    // Regex for bold (**text**), italic (*text* or _text_), inline code (`code`)
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|\*[^*]+?\*|`[^`]+?`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
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

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList();
      elements.push(
        <hr key={`hr-${index}`} className="my-3 border-stone-700/60" />
      );
      return;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${index}`} className="text-sm sm:text-base font-bold text-amber-300 mt-3 mb-1.5 flex items-center gap-1.5 font-serif">
          {parseInline(trimmed.substring(4))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${index}`} className="text-base sm:text-lg font-bold text-amber-400 mt-4 mb-2 font-serif">
          {parseInline(trimmed.substring(3))}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${index}`} className="text-lg sm:text-xl font-bold text-amber-300 mt-4 mb-2 font-serif">
          {parseInline(trimmed.substring(2))}
        </h1>
      );
      return;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={`quote-${index}`} className="border-l-2 border-amber-500/70 pl-3 py-1 my-2 italic text-stone-300 bg-stone-900/40 rounded-r">
          {parseInline(trimmed.substring(2))}
        </blockquote>
      );
      return;
    }

    // Unordered List (* or -)
    const bulletMatch = trimmed.match(/^[\*\-]\s+(.*)$/);
    if (bulletMatch) {
      if (isNumberedList) flushList();
      isNumberedList = false;
      currentListItems.push(
        <li key={`li-${index}`} className="leading-relaxed">
          {parseInline(bulletMatch[1])}
        </li>
      );
      return;
    }

    // Numbered List (1. 2. etc.)
    const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberMatch) {
      if (!isNumberedList && currentListItems.length > 0) flushList();
      isNumberedList = true;
      currentListItems.push(
        <li key={`li-${index}`} className="leading-relaxed">
          {parseInline(numberMatch[2])}
        </li>
      );
      return;
    }

    // Empty line
    if (!trimmed) {
      flushList();
      elements.push(<div key={`empty-${index}`} className="h-2" />);
      return;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${index}`} className="leading-relaxed my-1">
        {parseInline(line)}
      </p>
    );
  });

  flushList();

  return (
    <div className={`space-y-1 break-words text-stone-200 text-xs sm:text-sm ${className}`}>
      {elements}
    </div>
  );
};
