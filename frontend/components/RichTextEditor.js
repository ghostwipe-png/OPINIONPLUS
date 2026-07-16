'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Image as ImageIcon,
  Table2,
  Minus,
  Eraser,
  Palette,
  Highlighter,
  Code2,
} from 'lucide-react';

// Simple exec-command driven buttons, grouped for a professional toolbar.
// Each group is visually separated by a divider.
const INLINE_TOOLS = [
  { cmd: 'bold', icon: Bold, label: 'Bold (Ctrl+B)' },
  { cmd: 'italic', icon: Italic, label: 'Italic (Ctrl+I)' },
  { cmd: 'underline', icon: Underline, label: 'Underline (Ctrl+U)' },
  { cmd: 'strikeThrough', icon: Strikethrough, label: 'Strikethrough' },
];

const ALIGN_TOOLS = [
  { cmd: 'justifyLeft', icon: AlignLeft, label: 'Align left' },
  { cmd: 'justifyCenter', icon: AlignCenter, label: 'Align center' },
  { cmd: 'justifyRight', icon: AlignRight, label: 'Align right' },
  { cmd: 'justifyFull', icon: AlignJustify, label: 'Justify' },
];

const LIST_TOOLS = [
  { cmd: 'insertUnorderedList', icon: List, label: 'Bullet list' },
  { cmd: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
];

const BLOCK_FORMATS = [
  { value: 'P', label: 'Paragraph' },
  { value: 'H1', label: 'Heading 1' },
  { value: 'H2', label: 'Heading 2' },
  { value: 'H3', label: 'Heading 3' },
  { value: 'BLOCKQUOTE', label: 'Quote' },
  { value: 'PRE', label: 'Code block' },
];

const FONT_FAMILIES = [
  { value: '', label: 'Default' },
  { value: 'Inter, system-ui, sans-serif', label: 'Sans (Inter)' },
  { value: 'Georgia, serif', label: 'Serif (Georgia)' },
  { value: '"Playfair Display", Georgia, serif', label: 'Display (Playfair)' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: '"Courier New", Courier, monospace', label: 'Monospace' },
];

const FONT_SIZES = [
  { value: '13px', label: 'Small' },
  { value: '16px', label: 'Normal' },
  { value: '20px', label: 'Medium' },
  { value: '26px', label: 'Large' },
  { value: '34px', label: 'Huge' },
];

const TEXT_COLORS = ['#14171F', '#E0492B', '#C99A3B', '#2E7D5B', '#2A5FB0', '#7A3FB0', '#6B7180'];
const HIGHLIGHT_COLORS = ['transparent', '#FDF3C7', '#FCE1DB', '#DCEEDD', '#DCE8FB', '#EBDCF9'];

function Divider() {
  return <span className="w-px h-6 bg-wire mx-1" aria-hidden="true" />;
}

function ToolbarButton({ icon: Icon, label, onClick, active = false }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection focused
      onClick={onClick}
      className={`w-8 h-8 grid place-items-center rounded-sm transition-colors ${
        active ? 'bg-ink text-paper' : 'hover:bg-ink-50 text-ink-600'
      }`}
    >
      <Icon size={15} />
    </button>
  );
}

function ColorSwatchPicker({ icon: Icon, label, colors, onPick, onOpen }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        title={label}
        aria-label={label}
        onMouseDown={(e) => {
          e.preventDefault();
          onOpen?.();
        }}
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 grid place-items-center rounded-sm hover:bg-ink-50 text-ink-600"
      >
        <Icon size={15} />
      </button>
      {open && (
        <div
          className="absolute z-20 top-9 left-0 bg-paper border border-wire rounded-sm p-2 flex gap-1 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              title={c === 'transparent' ? 'No highlight' : c}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="w-6 h-6 rounded-full border border-wire"
              style={{
                background:
                  c === 'transparent'
                    ? 'repeating-conic-gradient(#DAD5C8 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                    : c,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RichTextEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const savedRange = useRef(null);

  // Load initial value once; further updates are driven by user input so we
  // don't fight the browser's own cursor management.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a copy of the current selection any time it changes inside the
  // editor, so toolbar controls that must steal focus (native color input,
  // <select> dropdowns) can restore it before applying a command.
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current && ref.current.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!savedRange.current) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange.current);
  };

  const emitChange = () => onChange(ref.current.innerHTML);

  const withSelection = (fn) => {
    restoreSelection();
    ref.current?.focus();
    fn();
    emitChange();
  };

  const exec = (cmd, arg) => withSelection(() => document.execCommand(cmd, false, arg));

  const setBlockFormat = (tag) => exec('formatBlock', tag);

  const setFontFamily = (font) => {
    if (!font) return;
    withSelection(() => {
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('fontName', false, font);
    });
  };

  // execCommand('fontSize') only accepts legacy sizes 1-7. The standard
  // workaround: apply a marker size, then swap the resulting <font size>
  // tags for real pixel values via inline style.
  const setFontSize = (px) => {
    withSelection(() => {
      document.execCommand('fontSize', false, '7');
      ref.current.querySelectorAll('font[size="7"]').forEach((el) => {
        el.removeAttribute('size');
        el.style.fontSize = px;
      });
    });
  };

  const setTextColor = (color) => {
    withSelection(() => {
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('foreColor', false, color);
    });
  };

  const setHighlight = (color) => {
    withSelection(() => {
      document.execCommand('styleWithCSS', false, true);
      const applied = document.execCommand('hiliteColor', false, color);
      if (!applied) document.execCommand('backColor', false, color);
    });
  };

  const addLink = () => {
    const url = prompt('Link URL (include https://)');
    if (url) exec('createLink', url);
  };

  const addImage = () => {
    const url = prompt('Image URL (include https://)');
    if (url) exec('insertImage', url);
  };

  const insertTable = () => {
    const rowsInput = prompt('Rows?', '3');
    const colsInput = prompt('Columns?', '3');
    const rows = Math.max(1, Math.min(20, parseInt(rowsInput, 10) || 3));
    const cols = Math.max(1, Math.min(10, parseInt(colsInput, 10) || 3));
    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += '<td>&nbsp;</td>';
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    exec('insertHTML', html);
  };

  const clearFormatting = () => {
    withSelection(() => {
      document.execCommand('removeFormat');
      document.execCommand('unlink');
    });
  };

  return (
    <div className="border border-wire rounded-sm">
      <div className="flex items-center gap-0.5 border-b border-wire p-2 flex-wrap">
        <ToolbarButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={() => exec('undo')} />
        <ToolbarButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={() => exec('redo')} />
        <Divider />

        <select
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(e) => {
            setBlockFormat(e.target.value);
            e.target.value = '';
          }}
          className="text-xs border border-wire rounded-sm px-2 py-1.5 bg-paper text-ink-600 max-w-[110px]"
          title="Paragraph style"
        >
          <option value="" disabled>
            Style
          </option>
          {BLOCK_FORMATS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(e) => {
            setFontFamily(e.target.value);
            e.target.value = '';
          }}
          className="text-xs border border-wire rounded-sm px-2 py-1.5 bg-paper text-ink-600 max-w-[110px]"
          title="Font family"
        >
          <option value="" disabled>
            Font
          </option>
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(e) => {
            setFontSize(e.target.value);
            e.target.value = '';
          }}
          className="text-xs border border-wire rounded-sm px-2 py-1.5 bg-paper text-ink-600 max-w-[90px]"
          title="Font size"
        >
          <option value="" disabled>
            Size
          </option>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <Divider />

        {INLINE_TOOLS.map((t) => (
          <ToolbarButton key={t.cmd} icon={t.icon} label={t.label} onClick={() => exec(t.cmd)} />
        ))}
        <ToolbarButton icon={Heading1} label="Heading 1" onClick={() => setBlockFormat('H1')} />
        <ToolbarButton icon={Heading2} label="Heading 2" onClick={() => setBlockFormat('H2')} />
        <ToolbarButton icon={Heading3} label="Heading 3" onClick={() => setBlockFormat('H3')} />
        <Divider />

        <ColorSwatchPicker icon={Palette} label="Text color" colors={TEXT_COLORS} onPick={setTextColor} onOpen={saveSelection} />
        <ColorSwatchPicker
          icon={Highlighter}
          label="Highlight color"
          colors={HIGHLIGHT_COLORS}
          onPick={setHighlight}
          onOpen={saveSelection}
        />
        <Divider />

        {ALIGN_TOOLS.map((t) => (
          <ToolbarButton key={t.cmd} icon={t.icon} label={t.label} onClick={() => exec(t.cmd)} />
        ))}
        <Divider />

        {LIST_TOOLS.map((t) => (
          <ToolbarButton key={t.cmd} icon={t.icon} label={t.label} onClick={() => exec(t.cmd)} />
        ))}
        <ToolbarButton icon={Quote} label="Quote" onClick={() => setBlockFormat('BLOCKQUOTE')} />
        <ToolbarButton icon={Code2} label="Code block" onClick={() => setBlockFormat('PRE')} />
        <Divider />

        <ToolbarButton icon={LinkIcon} label="Insert link" onClick={addLink} />
        <ToolbarButton icon={ImageIcon} label="Insert image" onClick={addImage} />
        <ToolbarButton icon={Table2} label="Insert table" onClick={insertTable} />
        <ToolbarButton icon={Minus} label="Horizontal rule" onClick={() => exec('insertHorizontalRule')} />
        <Divider />

        <button
          type="button"
          title="Subscript"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('subscript')}
          className="w-8 h-8 grid place-items-center rounded-sm hover:bg-ink-50 text-ink-600 text-xs font-semibold"
        >
          X<span className="text-[9px] align-sub">2</span>
        </button>
        <button
          type="button"
          title="Superscript"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('superscript')}
          className="w-8 h-8 grid place-items-center rounded-sm hover:bg-ink-50 text-ink-600 text-xs font-semibold"
        >
          X<span className="text-[9px] align-super">2</span>
        </button>
        <button
          type="button"
          title="Outdent"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('outdent')}
          className="h-8 px-2 grid place-items-center rounded-sm hover:bg-ink-50 text-ink-600 text-xs font-semibold"
        >
          ⇤
        </button>
        <button
          type="button"
          title="Indent"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('indent')}
          className="h-8 px-2 grid place-items-center rounded-sm hover:bg-ink-50 text-ink-600 text-xs font-semibold"
        >
          ⇥
        </button>
        <Divider />

        <ToolbarButton icon={Eraser} label="Clear formatting" onClick={clearFormatting} />
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onSelect={saveSelection}
        data-placeholder={placeholder}
        className="prose-story min-h-[300px] p-4 text-[1.02rem] outline-none
          [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-3
          [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
          [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-2
          [&_blockquote]:border-l-2 [&_blockquote]:border-signal [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-600
          [&_pre]:bg-ink-50 [&_pre]:border [&_pre]:border-wire [&_pre]:rounded-sm [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:overflow-x-auto
          [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
          [&_a]:text-signal [&_a]:underline
          [&_img]:max-w-full [&_img]:rounded-sm [&_img]:my-3
          [&_table]:w-full [&_table]:border-collapse [&_table]:my-3
          [&_td]:border [&_td]:border-wire [&_td]:p-2 [&_th]:border [&_th]:border-wire [&_th]:p-2 [&_th]:bg-ink-50
          [&_hr]:border-wire [&_hr]:my-4
          empty:before:content-[attr(data-placeholder)] empty:before:text-ink-400"
      />
    </div>
  );
}
