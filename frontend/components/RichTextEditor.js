'use client';
import DOMPurify from 'dompurify';
import { useEffect, useRef, useState, useCallback } from 'react';
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
  Video as VideoIcon,
  Table2,
  Minus,
  Eraser,
  Palette,
  Highlighter,
  Code2,
  History,
  Save,
  RotateCcw,
  X,
  Clock,
  BarChart3,
} from 'lucide-react';

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

const ADVERB_EXCLUDE = new Set([
  'only', 'family', 'reply', 'apply', 'supply', 'comply', 'imply', 'rally', 'bully',
  'jelly', 'belly', 'holy', 'ugly', 'early', 'likely', 'friendly', 'lovely', 'lonely',
  'silly', 'ally', 'italy', 'assembly', 'monopoly', 'supply', 'anomaly', 'butterfly',
]);

const WORDY_PHRASES = [
  'in order to', 'due to the fact that', 'at this point in time', 'in the event that',
  'for the purpose of', 'with regard to', 'in spite of the fact that', 'a large number of',
  'in the process of', 'it is important to note that', 'on a daily basis', 'in the near future',
  'has the ability to', 'with the exception of', 'in the majority of cases', 'until such time as',
];

const MAX_VERSIONS = 20;
const AUTOSAVE_INTERVAL_MS = 30000;

// ---------- Text analysis helpers ----------

function countSyllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  w = w.replace(/^y/, '');
  const matches = w.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function gradeLabel(grade) {
  if (!isFinite(grade) || grade <= 0) return '—';
  const g = Math.max(0, Math.round(grade));
  if (g <= 5) return `Grade ${g} · Very easy`;
  if (g <= 8) return `Grade ${g} · Easy`;
  if (g <= 10) return `Grade ${g} · Fairly easy`;
  if (g <= 12) return `Grade ${g} · Standard`;
  if (g <= 16) return `Grade ${g} · Fairly difficult`;
  return `Grade ${g}+ · Difficult`;
}

function analyzeText(text) {
  const words = text.match(/[A-Za-z'-]+/g) || [];
  const wordCount = words.length;
  const sentenceMatches = text.match(/[^.!?]+[.!?]+/g) || (text.trim() ? [text.trim()] : []);
  const sentenceCount = Math.max(sentenceMatches.length, wordCount ? 1 : 0);
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const readingTime = wordCount ? Math.max(1, Math.round(wordCount / 200)) : 0;

  let grade = 0;
  if (wordCount > 0 && sentenceCount > 0) {
    grade = 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59;
  }

  const passiveMatches = text.match(/\b(am|is|are|was|were|be|been|being)\s+\w+(ed|en)\b/gi) || [];

  const adverbMatches = (text.match(/\b\w+ly\b/gi) || []).filter(
    (w) => !ADVERB_EXCLUDE.has(w.toLowerCase())
  );

  const lower = text.toLowerCase();
  let wordyCount = 0;
  WORDY_PHRASES.forEach((p) => {
    wordyCount += lower.split(p).length - 1;
  });

  const longSentences = sentenceMatches.filter(
    (s) => (s.match(/[A-Za-z'-]+/g) || []).length > 28
  ).length;

  return {
    wordCount,
    sentenceCount,
    readingTime,
    grade,
    passiveCount: passiveMatches.length,
    adverbCount: adverbMatches.length,
    wordyCount: wordyCount + longSentences,
  };
}

// ---------- UI subcomponents ----------

function Divider() {
  return <span className="w-px h-6 bg-wire mx-1" aria-hidden="true" />;
}

function ToolbarButton({ icon: Icon, label, onClick, active = false }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
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

function StatBadge({ label, value, title }) {
  return (
    <span title={title} className="px-2 py-0.5 rounded-sm bg-ink-50 text-ink-600 whitespace-nowrap">
      <span className="font-semibold text-ink">{value}</span> {label}
    </span>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, draftId = 'default', autosave = true }) {
  const ref = useRef(null);
  const savedRange = useRef(null);
  const analyzeTimer = useRef(null);
  const lastSavedHtmlRef = useRef(null);
  const draftKey = `rte-draft:${draftId}`;
  const versionsKey = `rte-versions:${draftId}`;

  const [stats, setStats] = useState(analyzeText(''));
  const [showPassive, setShowPassive] = useState(false);
  const [showAdverb, setShowAdverb] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
    if (ref.current) {
      setStats(analyzeText(ref.current.innerText || ''));
      lastSavedHtmlRef.current = ref.current.innerHTML;
    }

    // Check for a locally saved draft that differs from the incoming value
    if (typeof window !== 'undefined' && autosave) {
      try {
        const raw = window.localStorage.getItem(draftKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.html && parsed.html !== (value || '')) {
            setPendingDraft(parsed);
          }
        }
        const rawVersions = window.localStorage.getItem(versionsKey);
        if (rawVersions) setVersions(JSON.parse(rawVersions) || []);
      } catch {
        // ignore malformed localStorage data
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave every 30s
  useEffect(() => {
    if (!autosave || typeof window === 'undefined') return undefined;
    const interval = setInterval(() => {
      if (!ref.current) return;
      const html = ref.current.innerHTML;
      if (html === lastSavedHtmlRef.current) return; // nothing new to save
      const entry = { html, savedAt: Date.now() };
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(entry));
        setVersions((prev) => {
          const next = [entry, ...prev].slice(0, MAX_VERSIONS);
          window.localStorage.setItem(versionsKey, JSON.stringify(next));
          return next;
        });
      } catch {
        // localStorage may be unavailable (private mode, quota) — fail silently
      }
      lastSavedHtmlRef.current = html;
      setLastSavedAt(entry.savedAt);
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosave]);

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

  const emitChange = () => {
  const html = ref.current.innerHTML;
  const clean = typeof window !== 'undefined' ? DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 's', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'span', 'div', 'font', 'mark', 'video', 'iframe', 'source'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'style', 'class', 'size', 'color', 'align', 'width', 'height', 'allowfullscreen', 'loading', 'frameborder', 'contenteditable', 'data-issue', 'data-caret-marker'],
    ALLOW_DATA_ATTR: true,
  }) : html;
  onChange(clean);
};

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

  const addVideo = () => {
    const url = prompt('Video URL (YouTube, Vimeo, or a direct .mp4/.webm link)');
    if (!url) return;

    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);

    let html;
    if (ytMatch) {
      html = `<div style="position:relative;padding-top:56.25%;margin:12px 0;border-radius:4px;overflow:hidden;" contenteditable="false"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe></div><p><br></p>`;
    } else if (vimeoMatch) {
      html = `<div style="position:relative;padding-top:56.25%;margin:12px 0;border-radius:4px;overflow:hidden;" contenteditable="false"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe></div><p><br></p>`;
    } else if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
      html = `<video controls src="${url}" style="max-width:100%;border-radius:4px;margin:12px 0;"></video><p><br></p>`;
    } else {
      html = `<div style="position:relative;padding-top:56.25%;margin:12px 0;border-radius:4px;overflow:hidden;" contenteditable="false"><iframe src="${url}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy"></iframe></div><p><br></p>`;
    }
    exec('insertHTML', html);
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

  // ---- Issue highlighting (passive voice / adverbs) ----
  // Runs on a debounce after typing stops. Preserves the caret via a temporary
  // marker span so re-wrapping text nodes doesn't disrupt where the user is typing.
  const highlightIssues = useCallback(() => {
    const root = ref.current;
    if (!root) return;

    const sel = window.getSelection();
    let marker = null;
    if (sel && sel.rangeCount > 0 && root.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0).cloneRange();
      range.collapse(true);
      marker = document.createElement('span');
      marker.setAttribute('data-caret-marker', 'true');
      try {
        range.insertNode(marker);
      } catch {
        marker = null;
      }
    }

    // Remove any existing highlight marks first
    root.querySelectorAll('mark[data-issue]').forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });

    if (showPassive || showAdverb) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (node.parentElement && node.parentElement.closest('mark[data-issue], [data-caret-marker], pre, code')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const textNodes = [];
      let n;
      while ((n = walker.nextNode())) textNodes.push(n);

      const passiveRe = /\b(am|is|are|was|were|be|been|being)\s+\w+(ed|en)\b/gi;
      const adverbRe = /\b\w+ly\b/gi;

      textNodes.forEach((node) => {
        const text = node.nodeValue;
        const matches = [];
        let m;
        if (showPassive) {
          passiveRe.lastIndex = 0;
          while ((m = passiveRe.exec(text))) matches.push({ start: m.index, end: m.index + m[0].length, type: 'passive' });
        }
        if (showAdverb) {
          adverbRe.lastIndex = 0;
          while ((m = adverbRe.exec(text))) {
            if (!ADVERB_EXCLUDE.has(m[0].toLowerCase())) {
              matches.push({ start: m.index, end: m.index + m[0].length, type: 'adverb' });
            }
          }
        }
        if (!matches.length) return;
        matches.sort((a, b) => a.start - b.start);
        const clean = [];
        let lastEnd = 0;
        matches.forEach((mt) => {
          if (mt.start >= lastEnd) {
            clean.push(mt);
            lastEnd = mt.end;
          }
        });

        const frag = document.createDocumentFragment();
        let cursor = 0;
        clean.forEach((mt) => {
          if (mt.start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, mt.start)));
          const mark = document.createElement('mark');
          mark.setAttribute('data-issue', mt.type);
          mark.className =
            mt.type === 'passive'
              ? 'bg-amber-200/70 rounded-sm'
              : 'bg-sky-200/70 rounded-sm';
          mark.textContent = text.slice(mt.start, mt.end);
          frag.appendChild(mark);
          cursor = mt.end;
        });
        if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
        node.parentNode.replaceChild(frag, node);
      });
    }

    if (marker && marker.parentNode) {
      const range = document.createRange();
      range.setStartBefore(marker);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      marker.parentNode.removeChild(marker);
    }

    emitChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPassive, showAdverb]);

  const scheduleAnalysis = useCallback(() => {
    clearTimeout(analyzeTimer.current);
    analyzeTimer.current = setTimeout(() => {
      if (!ref.current) return;
      setStats(analyzeText(ref.current.innerText || ''));
      if (showPassive || showAdverb) highlightIssues();
    }, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPassive, showAdverb, highlightIssues]);

  const handleInput = () => {
    emitChange();
    scheduleAnalysis();
  };

  // Re-run highlighting immediately when toggles change
  useEffect(() => {
    highlightIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPassive, showAdverb]);

  useEffect(() => {
    return () => clearTimeout(analyzeTimer.current);
  }, []);

  // ---- Draft / version history controls ----
  const restoreDraft = (entry) => {
    if (!ref.current || !entry) return;
    ref.current.innerHTML = entry.html;
    emitChange();
    setStats(analyzeText(ref.current.innerText || ''));
    lastSavedHtmlRef.current = entry.html;
    setPendingDraft(null);
  };

  const dismissDraft = () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    }
    setPendingDraft(null);
  };

  const saveVersionNow = () => {
    if (!ref.current || typeof window === 'undefined') return;
    const entry = { html: ref.current.innerHTML, savedAt: Date.now() };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(entry));
      setVersions((prev) => {
        const next = [entry, ...prev].slice(0, MAX_VERSIONS);
        window.localStorage.setItem(versionsKey, JSON.stringify(next));
        return next;
      });
    } catch {
      // ignore storage failures
    }
    lastSavedHtmlRef.current = entry.html;
    setLastSavedAt(entry.savedAt);
  };

  const restoreVersion = (entry) => {
    restoreDraft(entry);
    setHistoryOpen(false);
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
  };

  return (
    <div className="border border-wire rounded-sm overflow-hidden">
      {pendingDraft && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border-b border-wire px-3 py-2 text-xs text-ink-600">
          <span>
            An unsaved draft from <strong>{formatTime(pendingDraft.savedAt)}</strong> was found locally.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => restoreDraft(pendingDraft)}
              className="px-2 py-1 rounded-sm bg-ink text-paper hover:opacity-90"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={dismissDraft}
              className="px-2 py-1 rounded-sm hover:bg-ink-50 text-ink-600"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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
          <option value="" disabled>Style</option>
          {BLOCK_FORMATS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
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
          <option value="" disabled>Font</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
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
          <option value="" disabled>Size</option>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
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
        <ColorSwatchPicker icon={Highlighter} label="Highlight color" colors={HIGHLIGHT_COLORS} onPick={setHighlight} onOpen={saveSelection} />
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
        <ToolbarButton icon={VideoIcon} label="Insert video (YouTube, Vimeo, or direct link)" onClick={addVideo} />
        <ToolbarButton icon={Table2} label="Insert table" onClick={insertTable} />
        <ToolbarButton icon={Minus} label="Horizontal rule" onClick={() => exec('insertHorizontalRule')} />
        <Divider />

        <button type="button" title="Subscript" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('subscript')} className="w-8 h-8 grid place-items-center rounded-sm hover:bg-ink-50 text-ink-600 text-xs font-semibold">X<span className="text-[9px] align-sub">2</span></button>
        <button type="button" title="Superscript" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('superscript')} className="w-8 h-8 grid place-items-center rounded-sm hover:bg-ink-50 text-ink-600 text-xs font-semibold">X<span className="text-[9px] align-super">2</span></button>
        <button type="button" title="Outdent" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('outdent')} className="h-8 px-2 grid place-items-center rounded-sm hover:bg-ink-50 text-ink-600 text-xs font-semibold">⇤</button>
        <button type="button" title="Indent" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('indent')} className="h-8 px-2 grid place-items-center rounded-sm hover:bg-ink-50 text-ink-600 text-xs font-semibold">⇥</button>
        <Divider />

        <ToolbarButton icon={Eraser} label="Clear formatting" onClick={clearFormatting} />
        <Divider />

        <ToolbarButton
          icon={Highlighter}
          label="Highlight passive voice"
          active={showPassive}
          onClick={() => setShowPassive((v) => !v)}
        />
        <ToolbarButton
          icon={BarChart3}
          label="Highlight adverbs / wordiness"
          active={showAdverb}
          onClick={() => setShowAdverb((v) => !v)}
        />
        <Divider />

        <ToolbarButton icon={Save} label="Save version now" onClick={saveVersionNow} />
        <div className="relative">
          <ToolbarButton
            icon={History}
            label="Version history"
            active={historyOpen}
            onClick={() => setHistoryOpen((o) => !o)}
          />
          {historyOpen && (
            <div
              className="absolute z-30 top-9 right-0 w-72 max-h-80 overflow-y-auto bg-paper border border-wire rounded-sm shadow-lg p-2"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-xs font-semibold text-ink">Version history</span>
                <button type="button" onClick={() => setHistoryOpen(false)} className="text-ink-400 hover:text-ink">
                  <X size={14} />
                </button>
              </div>
              {versions.length === 0 && (
                <p className="text-xs text-ink-400 px-1 py-2">No saved versions yet. Versions are created automatically every 30s while you type, or via the save button.</p>
              )}
              <ul className="flex flex-col gap-1">
                {versions.map((v, i) => (
                  <li key={v.savedAt + '-' + i} className="flex items-center justify-between gap-2 text-xs px-1 py-1.5 rounded-sm hover:bg-ink-50">
                    <span className="text-ink-600">{formatTime(v.savedAt)}</span>
                    <button
                      type="button"
                      title="Restore this version"
                      onClick={() => restoreVersion(v)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-wire hover:bg-ink hover:text-paper"
                    >
                      <RotateCcw size={11} /> Restore
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        lang="en"
        onInput={handleInput}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onSelect={saveSelection}
        data-placeholder={placeholder}
        className="prose-story min-h-[300px] max-h-[600px] overflow-y-auto p-4 text-[1.02rem] outline-none break-words [word-break:break-word] [overflow-wrap:anywhere]
          [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:break-words
          [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:break-words
          [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:break-words
          [&_blockquote]:border-l-2 [&_blockquote]:border-signal [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-600 [&_blockquote]:break-words
          [&_pre]:bg-ink-50 [&_pre]:border [&_pre]:border-wire [&_pre]:rounded-sm [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words
          [&_ul]:list-disc [&_ul]:pl-6
          [&_ol]:list-decimal [&_ol]:pl-6
          [&_a]:text-signal [&_a]:underline [&_a]:break-words
          [&_img]:max-w-full [&_img]:rounded-sm [&_img]:my-3
          [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:block [&_table]:overflow-x-auto
          [&_td]:border [&_td]:border-wire [&_td]:p-2 [&_td]:break-words
          [&_th]:border [&_th]:border-wire [&_th]:p-2 [&_th]:bg-ink-50 [&_th]:break-words
          [&_hr]:border-wire [&_hr]:my-4
          empty:before:content-[attr(data-placeholder)] empty:before:text-ink-400"
      />

      <div className="flex items-center justify-between gap-3 border-t border-wire px-3 py-1.5 text-[11px] flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatBadge label="words" value={stats.wordCount} />
          <StatBadge label="sentences" value={stats.sentenceCount} />
          <StatBadge
            label="read"
            value={`${stats.readingTime} min`}
            title="Estimated reading time at 200 wpm"
          />
          <StatBadge
            label="readability"
            value={gradeLabel(stats.grade)}
            title="Flesch-Kincaid grade level"
          />
          <StatBadge
            label="passive"
            value={stats.passiveCount}
            title="Passive voice constructions detected"
          />
          <StatBadge
            label="wordy"
            value={stats.adverbCount + stats.wordyCount}
            title="Adverbs, filler phrases, and overly long sentences"
          />
        </div>
        <div className="flex items-center gap-1 text-ink-400">
          <Clock size={11} />
          <span>{lastSavedAt ? `Autosaved ${formatTime(lastSavedAt)}` : autosave ? 'Not yet saved' : 'Autosave off'}</span>
        </div>
      </div>
    </div>
  );
}
