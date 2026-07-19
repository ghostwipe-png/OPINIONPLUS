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
  Sparkles,
  FileText,
  Maximize2,
  Minimize2,
  HelpCircle,
  Users,
  ChevronDown,
  Loader2,
  Wand2,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

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
const PRESENCE_INTERVAL_MS = 8000;

// ---------- New in v10: AI actions, templates, shortcuts ----------

const AI_ACTIONS = [
  { key: 'improve', label: 'Improve writing', icon: Wand2, prompt: 'Improve the writing quality, clarity, and flow of the following text while preserving its meaning and voice. Return only the improved text.' },
  { key: 'summarize', label: 'Summarize', icon: FileText, prompt: 'Write a concise summary of the following text in 2-3 sentences. Return only the summary.' },
  { key: 'grammar', label: 'Fix grammar', icon: Sparkles, prompt: 'Correct grammar, spelling, and punctuation in the following text while preserving its meaning. Return only the corrected text.' },
];

const TONE_OPTIONS = ['Professional', 'Casual', 'Persuasive', 'Journalistic'];

const TEMPLATES = {
  news: {
    label: 'News Article',
    html: `<h1>Headline Goes Here</h1><p><strong>Lead paragraph:</strong> Summarize the who, what, when, where, why in 1-2 sentences.</p><p>Supporting detail and context. Add quotes and sourcing here.</p><p>Additional background information, ordered from most to least important (inverted pyramid).</p><p><br></p>`,
  },
  opinion: {
    label: 'Opinion Piece',
    html: `<h1>Opinion Title</h1><p><strong>Thesis:</strong> State your central argument clearly.</p><h2>Supporting argument 1</h2><p>Evidence and reasoning.</p><h2>Supporting argument 2</h2><p>Evidence and reasoning.</p><h2>Conclusion</h2><p>Restate your position and its implications.</p><p><br></p>`,
  },
  feature: {
    label: 'Feature Story',
    html: `<h1>Feature Title</h1><p><em>Narrative hook — open with a scene, anecdote, or striking detail.</em></p><h2>Scene one</h2><p>Set the stage.</p><h2>Scene two</h2><p>Develop the story.</p><h2>Resolution</h2><p>Bring the narrative to a close.</p><p><br></p>`,
  },
  interview: {
    label: 'Interview',
    html: `<h1>Interview with [Name]</h1><p><em>Brief introduction of the subject and context for the interview.</em></p><p><strong>Q:</strong> First question?</p><p><strong>A:</strong> Response.</p><p><strong>Q:</strong> Second question?</p><p><strong>A:</strong> Response.</p><p><br></p>`,
  },
  press: {
    label: 'Press Release',
    html: `<p><strong>FOR IMMEDIATE RELEASE</strong></p><h1>Press Release Headline</h1><p><strong>CITY, State — Date —</strong> Opening paragraph with the core announcement.</p><p>"Quote from a spokesperson or executive," said Name, Title.</p><p>Additional details and background.</p><p><strong>About [Organization]:</strong> Boilerplate description.</p><p><br></p>`,
  },
};

const SHORTCUTS = [
  { keys: 'Ctrl+B', desc: 'Bold' },
  { keys: 'Ctrl+I', desc: 'Italic' },
  { keys: 'Ctrl+U', desc: 'Underline' },
  { keys: 'Ctrl+K', desc: 'Insert link' },
  { keys: 'Ctrl+Space', desc: 'Open AI writing assistant' },
  { keys: 'Ctrl+Z', desc: 'Undo' },
  { keys: 'Ctrl+Shift+Z', desc: 'Redo' },
  { keys: 'Esc', desc: 'Exit focus mode' },
];

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

// Flesch reading ease (0-100, higher = easier). Separate from the FK grade
// used elsewhere, since the readability panel wants both.
function readingEase(wordCount, sentenceCount, syllableCount) {
  if (!wordCount || !sentenceCount) return 0;
  const ease = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
  return Math.max(0, Math.min(100, Math.round(ease)));
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
  );

  return {
    wordCount,
    sentenceCount,
    readingTime,
    grade,
    ease: readingEase(wordCount, sentenceCount, syllableCount),
    avgSentenceLength: sentenceCount ? Math.round((wordCount / sentenceCount) * 10) / 10 : 0,
    passiveCount: passiveMatches.length,
    adverbCount: adverbMatches.length,
    wordyCount: wordyCount + longSentences.length,
    hardSentences: longSentences.slice(0, 5).map((s) => s.trim()),
  };
}

// ---------- Markdown -> HTML (paste support) ----------

function looksLikeMarkdown(text) {
  return /(\*\*[^*]+\*\*|^#{1,3}\s|^-\s|^\d+\.\s|\[[^\]]+\]\([^)]+\)|```)/m.test(text);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inList = null; // 'ul' | 'ol' | null
  let inCode = false;
  let codeBuf = [];

  const inlineFormat = (line) =>
    escapeHtml(line)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const closeList = () => {
    if (inList) {
      html += inList === 'ul' ? '</ul>' : '</ol>';
      inList = null;
    }
  };

  for (const raw of lines) {
    const line = raw;
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeBuf = [];
      } else {
        inCode = false;
        html += `<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    const ul = line.match(/^[-*]\s+(.*)/);
    const ol = line.match(/^\d+\.\s+(.*)/);

    if (h3) { closeList(); html += `<h3>${inlineFormat(h3[1])}</h3>`; continue; }
    if (h2) { closeList(); html += `<h2>${inlineFormat(h2[1])}</h2>`; continue; }
    if (h1) { closeList(); html += `<h1>${inlineFormat(h1[1])}</h1>`; continue; }
    if (ul) {
      if (inList !== 'ul') { closeList(); html += '<ul>'; inList = 'ul'; }
      html += `<li>${inlineFormat(ul[1])}</li>`;
      continue;
    }
    if (ol) {
      if (inList !== 'ol') { closeList(); html += '<ol>'; inList = 'ol'; }
      html += `<li>${inlineFormat(ol[1])}</li>`;
      continue;
    }
    closeList();
    if (line.trim() === '') { html += '<p><br></p>'; continue; }
    html += `<p>${inlineFormat(line)}</p>`;
  }
  closeList();
  if (inCode && codeBuf.length) html += `<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`;
  return html;
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

  // ---- v10 additions: state ----
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiTone, setAiTone] = useState('Professional');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [readabilityOpen, setReadabilityOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [collaborators, setCollaborators] = useState([]);

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

  // ---- v10: Real-time collaboration presence heartbeat (best-effort) ----
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let cancelled = false;
    const beat = async () => {
      try {
        const res = await fetch(`${API_BASE}/presence/${encodeURIComponent(draftId)}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.collaborators)) {
          setCollaborators(data.collaborators);
        }
      } catch {
        // presence endpoint is best-effort; silently ignore if unavailable
      }
    };
    beat();
    const interval = setInterval(beat, PRESENCE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [draftId]);

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
      ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 's', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'span', 'div', 'font', 'mark', 'video', 'iframe', 'source'],
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

  // v10: image insertion now supports an optional caption -> <figure><figcaption>
  const addImage = () => {
    const url = prompt('Image URL (include https://)');
    if (!url) return;
    const caption = prompt('Caption (optional, leave blank to skip)');
    if (caption && caption.trim()) {
      const html = `<figure contenteditable="false"><img src="${url}" alt="${caption.trim().replace(/"/g, '&quot;')}" /><figcaption>${caption.trim()}</figcaption></figure><p><br></p>`;
      exec('insertHTML', html);
    } else {
      exec('insertImage', url);
    }
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

  // ---- v10: Writing templates ----
  const insertTemplate = (key) => {
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    ref.current?.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertHTML', false, tpl.html);
    emitChange();
    setStats(analyzeText(ref.current.innerText || ''));
    setTemplatesOpen(false);
  };

  // ---- v10: AI writing assistant ----
  const getSelectedTextOrAll = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current && ref.current.contains(sel.anchorNode) && !sel.isCollapsed) {
      return { text: sel.toString(), hasSelection: true };
    }
    return { text: ref.current?.innerText || '', hasSelection: false };
  };

  const runAiAction = async (actionKey, toneOverride) => {
    const action = AI_ACTIONS.find((a) => a.key === actionKey) || { key: 'tone', prompt: `Rewrite the following text in a ${toneOverride} tone, preserving its meaning. Return only the rewritten text.` };
    const { text, hasSelection } = getSelectedTextOrAll();
    if (!text.trim()) {
      setAiError('Select some text or write a draft first.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/writing-assist`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: action.prompt, text, action: action.key, tone: toneOverride || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI request failed');
      const resultText = data.result || data.text || '';
      if (!resultText) throw new Error('No result returned');

      saveSelection();
      ref.current?.focus();
      restoreSelection();
      const sel = window.getSelection();
      const html = resultText
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
      if (hasSelection && sel && sel.rangeCount > 0) {
        document.execCommand('insertHTML', false, html);
      } else {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertHTML', false, html);
      }
      emitChange();
      setStats(analyzeText(ref.current.innerText || ''));
    } catch (e) {
      setAiError(e.message || 'AI writing assistant is unavailable right now.');
    }
    setAiLoading(false);
  };

  const simplifyReadability = () => runAiAction('improve', null).then(() => {});

  // ---- v10: Markdown paste support ----
  const handlePaste = (e) => {
    const text = e.clipboardData?.getData('text/plain');
    const html = e.clipboardData?.getData('text/html');
    if (text && !html && looksLikeMarkdown(text)) {
      e.preventDefault();
      const converted = markdownToHtml(text);
      restoreSelection();
      ref.current?.focus();
      document.execCommand('insertHTML', false, converted);
      emitChange();
      scheduleAnalysis();
    }
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

  // ---- v10: global keyboard shortcuts (Ctrl+Space for AI, Escape for focus mode) ----
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        saveSelection();
        setAiPanelOpen((o) => !o);
      } else if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusMode]);

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

  const easeLabel = (ease) => {
    if (ease >= 80) return 'Very easy';
    if (ease >= 60) return 'Easy';
    if (ease >= 50) return 'Fairly easy';
    if (ease >= 30) return 'Difficult';
    return 'Very difficult';
  };

  return (
    <div className={focusMode ? 'fixed inset-0 z-50 bg-paper flex flex-col' : 'border border-wire rounded-sm overflow-hidden'}>
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

      <div className={`flex items-center gap-0.5 border-b border-wire p-2 flex-wrap ${focusMode ? 'opacity-40 hover:opacity-100 transition-opacity' : ''}`}>
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
        <ToolbarButton icon={ImageIcon} label="Insert image (with optional caption)" onClick={addImage} />
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

        {/* v10: Templates */}
        <div className="relative">
          <button
            type="button"
            title="Writing templates"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTemplatesOpen((o) => !o)}
            className={`h-8 px-2 flex items-center gap-1 rounded-sm text-xs font-semibold ${templatesOpen ? 'bg-ink text-paper' : 'hover:bg-ink-50 text-ink-600'}`}
          >
            <FileText size={14} /> Templates <ChevronDown size={12} />
          </button>
          {templatesOpen && (
            <div className="absolute z-20 top-9 left-0 w-56 bg-paper border border-wire rounded-sm shadow-lg py-1" onMouseDown={(e) => e.preventDefault()}>
              {Object.entries(TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => insertTemplate(key)}
                  className="w-full text-left px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* v10: AI writing assistant */}
        <div className="relative">
          <button
            type="button"
            title="AI writing assistant (Ctrl+Space)"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
            }}
            onClick={() => setAiPanelOpen((o) => !o)}
            className={`h-8 px-2 flex items-center gap-1 rounded-sm text-xs font-semibold ${aiPanelOpen ? 'bg-ink text-paper' : 'hover:bg-ink-50 text-ink-600'}`}
          >
            <Sparkles size={14} /> AI
          </button>
          {aiPanelOpen && (
            <div className="absolute z-30 top-9 right-0 w-72 bg-paper border border-wire rounded-sm shadow-lg p-3" onMouseDown={(e) => e.preventDefault()}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-ink">AI writing assistant</span>
                <button type="button" onClick={() => setAiPanelOpen(false)} className="text-ink-400 hover:text-ink"><X size={14} /></button>
              </div>
              <p className="text-[11px] text-ink-400 mb-2">Acts on your selected text, or the whole draft if nothing is selected.</p>
              <div className="flex flex-col gap-1 mb-2">
                {AI_ACTIONS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    disabled={aiLoading}
                    onClick={() => runAiAction(a.key)}
                    className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-sm border border-wire hover:bg-ink-50 disabled:opacity-50"
                  >
                    <a.icon size={13} /> {a.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-wire pt-2">
                <p className="text-[11px] font-semibold text-ink-600 mb-1">Change tone</p>
                <div className="flex flex-wrap gap-1">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={aiLoading}
                      onClick={() => {
                        setAiTone(t);
                        runAiAction('tone', t);
                      }}
                      className={`text-[11px] px-2 py-1 rounded-sm border ${aiTone === t ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600 hover:bg-ink-50'} disabled:opacity-50`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {aiLoading && (
                <p className="mt-2 text-xs text-ink-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Thinking…</p>
              )}
              {aiError && <p className="mt-2 text-xs text-signal">{aiError}</p>}
            </div>
          )}
        </div>
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
        <Divider />

        {/* v10: collaboration presence */}
        {collaborators.length > 0 && (
          <div className="flex items-center gap-1 px-1" title={collaborators.map((c) => c.name).join(', ') + ' also editing'}>
            <Users size={13} className="text-ink-400" />
            <div className="flex -space-x-1.5">
              {collaborators.slice(0, 4).map((c, i) => (
                <img
                  key={c.id || i}
                  src={c.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.name || 'U')}`}
                  alt={c.name}
                  className="w-5 h-5 rounded-full border border-paper object-cover"
                />
              ))}
            </div>
            <span className="text-[10px] text-ink-400 hidden sm:inline">
              {collaborators.length === 1 ? `${collaborators[0].name} is also editing` : `${collaborators.length} editing`}
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarButton icon={HelpCircle} label="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)} />
          <ToolbarButton
            icon={focusMode ? Minimize2 : Maximize2}
            label={focusMode ? 'Exit focus mode (Esc)' : 'Focus mode'}
            active={focusMode}
            onClick={() => setFocusMode((v) => !v)}
          />
        </div>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        lang="en"
        onInput={handleInput}
        onPaste={handlePaste}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onSelect={saveSelection}
        data-placeholder={placeholder}
        className={`prose-story overflow-y-auto p-4 text-[1.02rem] outline-none break-words [word-break:break-word] [overflow-wrap:anywhere] ${focusMode ? 'flex-1 max-w-3xl mx-auto w-full' : 'min-h-[300px] max-h-[600px]'}
          [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:break-words
          [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:break-words
          [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:break-words
          [&_blockquote]:border-l-2 [&_blockquote]:border-signal [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-600 [&_blockquote]:break-words
          [&_pre]:bg-ink-50 [&_pre]:border [&_pre]:border-wire [&_pre]:rounded-sm [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words
          [&_ul]:list-disc [&_ul]:pl-6
          [&_ol]:list-decimal [&_ol]:pl-6
          [&_a]:text-signal [&_a]:underline [&_a]:break-words
          [&_img]:max-w-full [&_img]:rounded-sm [&_img]:my-3
          [&_figure]:my-3 [&_figcaption]:text-xs [&_figcaption]:italic [&_figcaption]:text-ink-400 [&_figcaption]:mt-1 [&_figcaption]:text-center
          [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:block [&_table]:overflow-x-auto
          [&_td]:border [&_td]:border-wire [&_td]:p-2 [&_td]:break-words
          [&_th]:border [&_th]:border-wire [&_th]:p-2 [&_th]:bg-ink-50 [&_th]:break-words
          [&_hr]:border-wire [&_hr]:my-4
          empty:before:content-[attr(data-placeholder)] empty:before:text-ink-400`}
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
          <button
            type="button"
            onClick={() => setReadabilityOpen((o) => !o)}
            className={`px-2 py-0.5 rounded-sm whitespace-nowrap flex items-center gap-1 ${readabilityOpen ? 'bg-ink text-paper' : 'bg-ink-50 text-ink-600'}`}
            title="Expand readability panel"
          >
            <span className="font-semibold">{gradeLabel(stats.grade)}</span>
            <ChevronDown size={11} className={readabilityOpen ? 'rotate-180' : ''} />
          </button>
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

      {/* v10: Enhanced readability panel */}
      {readabilityOpen && (
        <div className="border-t border-wire px-4 py-3 text-xs bg-ink-50/50 flex flex-col gap-2">
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-ink-400">Flesch-Kincaid grade</p>
              <p className="font-semibold text-ink">{gradeLabel(stats.grade)}</p>
            </div>
            <div>
              <p className="text-ink-400">Reading ease</p>
              <p className="font-semibold text-ink">{stats.ease}/100 · {easeLabel(stats.ease)}</p>
            </div>
            <div>
              <p className="text-ink-400">Avg sentence length</p>
              <p className="font-semibold text-ink">{stats.avgSentenceLength} words</p>
            </div>
            <div>
              <p className="text-ink-400">Target range</p>
              <p className="font-semibold text-ink">Grade 6–8 (good for general public)</p>
            </div>
          </div>
          {stats.hardSentences.length > 0 && (
            <div>
              <p className="text-ink-400 mb-1">Hard sentences (28+ words)</p>
              <ul className="flex flex-col gap-1">
                {stats.hardSentences.map((s, i) => (
                  <li key={i} className="text-ink-600 bg-paper border border-wire rounded-sm px-2 py-1">{s}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={simplifyReadability}
            disabled={aiLoading}
            className="self-start flex items-center gap-1 px-2 py-1.5 rounded-sm bg-ink text-paper text-xs font-semibold disabled:opacity-50"
          >
            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Simplify with AI
          </button>
        </div>
      )}

      {/* v10: Keyboard shortcuts modal */}
      {shortcutsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          className="fixed inset-0 z-[60] bg-ink/40 flex items-center justify-center p-4"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="bg-paper border border-wire rounded-sm shadow-lg w-full max-w-sm p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink">Keyboard shortcuts</h3>
              <button type="button" onClick={() => setShortcutsOpen(false)} aria-label="Close" className="text-ink-400 hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <ul className="flex flex-col gap-1.5">
              {SHORTCUTS.map((s) => (
                <li key={s.keys} className="flex items-center justify-between text-xs">
                  <span className="text-ink-600">{s.desc}</span>
                  <kbd className="px-1.5 py-0.5 rounded-sm bg-ink-50 border border-wire font-mono text-[11px]">{s.keys}</kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
