'use client';

import { useEffect, useRef } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Quote, Heading2 } from 'lucide-react';

const TOOLS = [
  { cmd: 'bold', icon: Bold, label: 'Bold' },
  { cmd: 'italic', icon: Italic, label: 'Italic' },
  { cmd: 'underline', icon: Underline, label: 'Underline' },
  { cmd: 'formatBlock', arg: 'H2', icon: Heading2, label: 'Heading' },
  { cmd: 'insertUnorderedList', icon: List, label: 'Bullet list' },
  { cmd: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
  { cmd: 'formatBlock', arg: 'BLOCKQUOTE', icon: Quote, label: 'Quote' },
];

export default function RichTextEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd, arg) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current.innerHTML);
  };

  const addLink = () => {
    const url = prompt('Link URL');
    if (url) exec('createLink', url);
  };

  return (
    <div className="border border-wire rounded-sm">
      <div className="flex items-center gap-1 border-b border-wire p-2 flex-wrap">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            onClick={() => exec(t.cmd, t.arg)}
            className="w-8 h-8 grid place-items-center rounded-sm hover:bg-ink-50 text-ink-600"
          >
            <t.icon size={15} />
          </button>
        ))}
        <button
          type="button"
          title="Link"
          onClick={addLink}
          className="w-8 h-8 grid place-items-center rounded-sm hover:bg-ink-50 text-ink-600"
        >
          <LinkIcon size={15} />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        className="prose-story min-h-[300px] p-4 text-[1.02rem] outline-none [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_blockquote]:border-l-2 [&_blockquote]:border-signal [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-600 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 empty:before:content-[attr(data-placeholder)] empty:before:text-ink-400"
      />
    </div>
  );
}
