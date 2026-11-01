import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Eye,
  Edit3,
  Sparkles,
  AlertCircle,
  Check,
  RefreshCw,
  RemoveFormatting,
  Eraser,
  Link2,
} from 'lucide-react';
import { ArticleItem, UserProfile } from '../../types';
import { createArticle, updateArticle } from '../../lib/articleService';
import { processArticleHtmlLinks } from '../../lib/linkUtils';

interface ArticleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile;
  initialArticle?: ArticleItem | null;
  onSaved: () => void;
}

const PRESET_COVERS = [
  {
    name: 'Mindset & Study',
    url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Career & University',
    url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Medical & Healthcare',
    url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Technology & AI',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Productivity & Habits',
    url: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80',
  },
];

const CATEGORY_OPTIONS = [
  'General Career Guidance',
  'Exam Strategy & Mindset',
  'Medical & Healthcare',
  'Tech & Modern Fields',
  'Engineering & Sciences',
  'University Admissions',
  'Student Life & Productivity',
  'Soft Skills & Interview Prep',
];

export const ArticleEditorModal: React.FC<ArticleEditorModalProps> = ({
  isOpen,
  onClose,
  currentUserProfile,
  initialArticle,
  onSaved,
}) => {
  const isEditing = !!initialArticle;

  const [title, setTitle] = useState(initialArticle?.title || '');
  const [description, setDescription] = useState(initialArticle?.description || '');
  const [category, setCategory] = useState(initialArticle?.category || CATEGORY_OPTIONS[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [coverImage, setCoverImage] = useState(initialArticle?.coverImage || '');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  // Active formatting state for real-time visual feedback and reliable toggle/deselection
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
    heading2: false,
    heading3: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    highlightColor: null as 'yellow' | 'pink' | null,
  });

  // Save current selection range so clicking toolbar doesn't drop caret position
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  };

  const restoreSelection = () => {
    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRangeRef.current) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        }
      }
    }
  };

  // Check active formatting at current cursor / selection
  const updateFormatState = () => {
    if (!editorRef.current) return;
    saveSelection();

    try {
      const bold = document.queryCommandState('bold');
      const italic = document.queryCommandState('italic');
      const underline = document.queryCommandState('underline');
      const bulletList = document.queryCommandState('insertUnorderedList');
      const orderedList = document.queryCommandState('insertOrderedList');

      let heading2 = false;
      let heading3 = false;
      let blockquote = false;
      let highlightColor: 'yellow' | 'pink' | null = null;

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        while (node && node !== editorRef.current && node !== document.body) {
          if (node instanceof HTMLElement) {
            const tag = node.tagName.toUpperCase();
            if (tag === 'H2') heading2 = true;
            if (tag === 'H3') heading3 = true;
            if (tag === 'BLOCKQUOTE') blockquote = true;

            const bg = (node.style.backgroundColor || '').toLowerCase();
            if (
              bg.includes('254, 240, 138') ||
              bg.includes('fef08a') ||
              bg.includes('yellow') ||
              node.classList.contains('bg-yellow-200')
            ) {
              highlightColor = 'yellow';
            } else if (
              bg.includes('251, 207, 232') ||
              bg.includes('fbcfe8') ||
              bg.includes('pink') ||
              node.classList.contains('bg-pink-200')
            ) {
              highlightColor = 'pink';
            }
          }
          node = node.parentNode;
        }
      }

      setFormatState({
        bold,
        italic,
        underline,
        heading2,
        heading3,
        blockquote,
        bulletList,
        orderedList,
        highlightColor,
      });
    } catch {
      // Ignore transient selection errors
    }
  };

  // Sync initial content on open or article change
  React.useEffect(() => {
    if (isOpen && editorRef.current) {
      editorRef.current.innerHTML = initialArticle?.content || '';
    }
  }, [isOpen, initialArticle]);

  // Listen to selection changes to keep toolbar state in sync
  React.useEffect(() => {
    if (!isOpen) return;
    const handleSelectionChange = () => {
      updateFormatState();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Compress and convert image to base64
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setCoverImage(compressedDataUrl);
          setErrorMsg(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Toggle inline formatting (Bold, Italic, Underline) - toggles between selected and deselected
  const toggleInlineFormat = (command: 'bold' | 'italic' | 'underline') => {
    restoreSelection();
    document.execCommand(command, false);
    setTimeout(updateFormatState, 20);
  };

  // Toggle Highlight (Yellow or Pink) - if already active, it DESELECTS / removes highlight
  const toggleHighlight = (color: 'yellow' | 'pink') => {
    restoreSelection();
    const hex = color === 'yellow' ? '#fef08a' : '#fbcfe8';

    if (formatState.highlightColor === color) {
      // DESELECT: Clear highlight from the selected text
      document.execCommand('hiliteColor', false, 'transparent');
      // Clean up any remaining background styles on active nodes
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        while (node && node !== editorRef.current && node !== document.body) {
          if (node instanceof HTMLElement) {
            if (node.style.backgroundColor || node.tagName === 'MARK') {
              node.style.backgroundColor = '';
            }
          }
          node = node.parentNode;
        }
      }
    } else {
      // SELECT: Apply color highlight
      document.execCommand('hiliteColor', false, hex);
    }
    setTimeout(updateFormatState, 20);
  };

  // Toggle Block Elements (Heading 2, Heading 3, Blockquote) - if already active, DESELECTS back to <p>
  const toggleBlockTag = (tag: 'h2' | 'h3' | 'blockquote') => {
    restoreSelection();
    const isActive =
      (tag === 'h2' && formatState.heading2) ||
      (tag === 'h3' && formatState.heading3) ||
      (tag === 'blockquote' && formatState.blockquote);

    if (isActive) {
      // DESELECT: Revert to standard paragraph
      document.execCommand('formatBlock', false, '<p>');
    } else {
      // SELECT: Apply block tag
      document.execCommand('formatBlock', false, `<${tag}>`);
    }
    setTimeout(updateFormatState, 20);
  };

  // Toggle List (Bullet / Numbered)
  const toggleList = (command: 'insertUnorderedList' | 'insertOrderedList') => {
    restoreSelection();
    document.execCommand(command, false);
    setTimeout(updateFormatState, 20);
  };

  // Horizontal divider rule
  const insertDivider = () => {
    restoreSelection();
    document.execCommand('insertHorizontalRule', false);
    setTimeout(updateFormatState, 20);
  };

  // Insert or edit hyperlink (Target _blank guaranteed)
  const promptInsertLink = () => {
    restoreSelection();
    const url = window.prompt('Enter link URL (e.g. https://hec.gov.pk):');
    if (!url || !url.trim()) return;

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.toString().trim() === '') {
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${finalUrl}" target="_blank" rel="noopener noreferrer">${finalUrl}</a>&nbsp;`
      );
    } else {
      document.execCommand('createLink', false, finalUrl);
      if (editorRef.current) {
        const anchors = editorRef.current.querySelectorAll('a');
        anchors.forEach((a) => {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        });
      }
    }
    setTimeout(updateFormatState, 20);
  };

  // Clear all formatting on selected text (Deselect all)
  const clearFormatting = () => {
    restoreSelection();
    document.execCommand('removeFormat', false);
    document.execCommand('formatBlock', false, '<p>');
    document.execCommand('hiliteColor', false, 'transparent');
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.anchorNode;
      while (node && node !== editorRef.current && node !== document.body) {
        if (node instanceof HTMLElement) {
          node.style.backgroundColor = '';
        }
        node = node.parentNode;
      }
    }
    setTimeout(updateFormatState, 20);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const htmlContent = editorRef.current?.innerHTML || '';
    const plainText = editorRef.current?.innerText?.trim() || '';

    // Strict validation of mandatory fields
    if (!coverImage.trim()) {
      setErrorMsg('Cover image is mandatory. Please upload an image or choose a preset.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Article Title is mandatory. Please provide a clear, informative title.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Article Description is mandatory. Please provide a brief summary.');
      return;
    }
    if (!plainText && !htmlContent.includes('<img') && !htmlContent.includes('<hr')) {
      setErrorMsg('Article Content is mandatory. Please write the article body.');
      return;
    }

    // Calculate approximate read time (average 180 words/min)
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 180));

    const finalCategory = category === 'Other' && customCategory.trim() ? customCategory.trim() : category;
    const finalContent = processArticleHtmlLinks(htmlContent.trim());

    setSaving(true);
    try {
      if (isEditing && initialArticle) {
        await updateArticle(initialArticle.id, {
          title: title.trim(),
          description: description.trim(),
          coverImage: coverImage.trim(),
          category: finalCategory,
          content: finalContent,
          readTimeMinutes,
        });
      } else {
        await createArticle({
          title: title.trim(),
          description: description.trim(),
          coverImage: coverImage.trim(),
          category: finalCategory,
          content: finalContent,
          readTimeMinutes,
          authorId: currentUserProfile.uid,
          authorName: currentUserProfile.displayName,
          authorRole: currentUserProfile.role,
          authorPhotoURL: currentUserProfile.photoURL || '',
          authorProfessionalTitle: currentUserProfile.professionalTitle || '',
          authorQualification: currentUserProfile.qualification || '',
          authorBio: currentUserProfile.shortDescription || '',
          likesCount: 0,
          likedBy: [],
          viewsCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Save article error:', err);
      setErrorMsg(err.message || 'Failed to publish article. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-pink-100 overflow-hidden relative animate-pop-in my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-pink-100 bg-pink-50/50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-pink-700 text-white flex items-center justify-center shadow-xs shadow-pink-200 shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {isEditing ? 'Edit Informative Article' : 'Post New Informative Article'}
              </h2>
              <p className="text-xs text-slate-500">
                Share guidance, career insights, or mindset strategies with all students.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-pink-100/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Mandatory Cover Image Section */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-pink-600" />
                Cover Picture <span className="text-rose-600 font-bold">* (Mandatory)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                Upload from device or select a preset
              </span>
            </label>

            {coverImage ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-21/9 max-h-56 bg-slate-900 shadow-xs">
                <img src={coverImage} alt="Cover preview" className="w-full h-full object-cover" />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white/95 hover:bg-white text-slate-800 rounded-xl text-xs font-bold shadow-md hover:bg-pink-50 cursor-pointer backdrop-blur-md transition-all active:scale-95"
                  >
                    Change Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverImage('')}
                    className="px-3 py-1.5 bg-rose-600/95 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer backdrop-blur-md transition-all active:scale-95"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-pink-200 hover:border-pink-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-pink-50/20 hover:bg-pink-50/50 flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-pink-100 text-pink-700 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-pink-700 underline">Click to upload cover picture</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, WebP (Landscape recommended)</p>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
            />

            {/* Quick Preset Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 text-xs">
              <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">Presets:</span>
              {PRESET_COVERS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setCoverImage(preset.url)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all shrink-0 cursor-pointer ${
                    coverImage === preset.url
                      ? 'bg-pink-600 text-white border-pink-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300 hover:bg-pink-50'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Mandatory Title & Category Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                Article Title <span className="text-rose-600 font-bold">* (Mandatory)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 5 Habits of High-Performing Medical & Engineering Aspirants"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all font-semibold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all bg-white font-medium"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="Other">Custom Category...</option>
              </select>
            </div>
          </div>

          {category === 'Other' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">Custom Category Name</label>
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter custom topic name..."
                className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-pink-500"
              />
            </div>
          )}

          {/* 3. Mandatory Short Description / Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>
                Short Summary / Teaser <span className="text-rose-600 font-bold">* (Mandatory)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                {description.length} / 250 characters
              </span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief 1-2 sentence overview of what students will learn from this article..."
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all"
              required
            />
          </div>

          {/* 4. Mandatory Content with Live Visual WYSIWYG Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                Article Body & Content <span className="text-rose-600 font-bold">* (Mandatory)</span>
              </label>
              <span className="text-[11px] text-pink-700 font-semibold bg-pink-50 border border-pink-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-pink-500" />
                <span>Live Visual Editor (What you see is what publishes)</span>
              </span>
            </div>

            {/* Visual Formatting Toolbar with Active States and Full Deselect Support */}
            <div className="flex items-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-t-2xl overflow-x-auto text-xs scrollbar-none flex-nowrap select-none">
              {/* Bold Toggle */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleInlineFormat('bold');
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  toggleInlineFormat('bold');
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 border ${
                  formatState.bold
                    ? 'bg-pink-600 text-white border-pink-600 shadow-xs font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90'
                }`}
                title={formatState.bold ? 'Bold (Active - click to deselect)' : 'Bold (Click to apply)'}
              >
                <Bold className="w-4 h-4" />
              </button>

              {/* Italic Toggle */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleInlineFormat('italic');
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  toggleInlineFormat('italic');
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 border ${
                  formatState.italic
                    ? 'bg-pink-600 text-white border-pink-600 shadow-xs font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90'
                }`}
                title={formatState.italic ? 'Italic (Active - click to deselect)' : 'Italic (Click to apply)'}
              >
                <Italic className="w-4 h-4" />
              </button>

              {/* Underline Toggle */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleInlineFormat('underline');
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  toggleInlineFormat('underline');
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 border ${
                  formatState.underline
                    ? 'bg-pink-600 text-white border-pink-600 shadow-xs font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90'
                }`}
                title={formatState.underline ? 'Underline (Active - click to deselect)' : 'Underline (Click to apply)'}
              >
                <Underline className="w-4 h-4" />
              </button>

              <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />

              {/* Yellow Highlight Toggle */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleHighlight('yellow');
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  toggleHighlight('yellow');
                }}
                className={`px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0 border ${
                  formatState.highlightColor === 'yellow'
                    ? 'bg-yellow-200 text-yellow-950 border-yellow-400 ring-2 ring-yellow-400 shadow-xs font-bold'
                    : 'bg-white hover:bg-yellow-50 text-slate-700 border-slate-200/90'
                }`}
                title={
                  formatState.highlightColor === 'yellow'
                    ? 'Yellow Highlight (Active - click to deselect / remove highlight)'
                    : 'Yellow Highlight (Click to apply)'
                }
              >
                <span className="w-3.5 h-3.5 rounded-full bg-yellow-300 border border-yellow-500 shrink-0" />
                <span>Yellow</span>
              </button>

              {/* Pink Highlight Toggle */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleHighlight('pink');
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  toggleHighlight('pink');
                }}
                className={`px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0 border ${
                  formatState.highlightColor === 'pink'
                    ? 'bg-pink-200 text-pink-950 border-pink-400 ring-2 ring-pink-400 shadow-xs font-bold'
                    : 'bg-white hover:bg-pink-50 text-slate-700 border-slate-200/90'
                }`}
                title={
                  formatState.highlightColor === 'pink'
                    ? 'Pink Highlight (Active - click to deselect / remove highlight)'
                    : 'Pink Highlight (Click to apply)'
                }
              >
                <span className="w-3.5 h-3.5 rounded-full bg-pink-300 border border-pink-500 shrink-0" />
                <span>Pink</span>
              </button>

              <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />

              {/* Headings (H2 / H3 / Normal Paragraph) with Reliable Toggle/Deselect */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleBlockTag('h2');
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  toggleBlockTag('h2');
                }}
                className={`px-2.5 py-1.5 rounded-xl transition-all cursor-pointer text-xs shrink-0 border ${
                  formatState.heading2
                    ? 'bg-pink-600 text-white border-pink-600 shadow-xs font-extrabold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 font-bold'
                }`}
                title={formatState.heading2 ? 'Heading 2 (Active - click to deselect back to normal text)' : 'Heading 2 (Section Title)'}
              >
                H2
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleBlockTag('h3');
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  toggleBlockTag('h3');
                }}
                className={`px-2.5 py-1.5 rounded-xl transition-all cursor-pointer text-xs shrink-0 border ${
                  formatState.heading3
                    ? 'bg-pink-600 text-white border-pink-600 shadow-xs font-extrabold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90 font-bold'
                }`}
                title={formatState.heading3 ? 'Heading 3 (Active - click to deselect back to normal text)' : 'Heading 3 (Sub-heading)'}
              >
                H3
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  document.execCommand('formatBlock', false, '<p>');
                  updateFormatState();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  document.execCommand('formatBlock', false, '<p>');
                  updateFormatState();
                }}
                className={`px-2.5 py-1.5 rounded-xl transition-all cursor-pointer text-xs shrink-0 border ${
                  !formatState.heading2 && !formatState.heading3 && !formatState.blockquote
                    ? 'bg-slate-200 text-slate-800 font-bold border-slate-300'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200/90 font-medium'
                }`}
                title="Normal Paragraph text"
              >
                Paragraph
              </button>

              <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />

              {/* Lists & Quotes */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleList('insertUnorderedList');
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  toggleList('insertUnorderedList');
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 border ${
                  formatState.bulletList
                    ? 'bg-pink-600 text-white border-pink-600 shadow-xs font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90'
                }`}
                title={formatState.bulletList ? 'Bullet List (Active - click to deselect)' : 'Bullet List'}
              >
                <List className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleList('insertOrderedList');
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  toggleList('insertOrderedList');
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 border ${
                  formatState.orderedList
                    ? 'bg-pink-600 text-white border-pink-600 shadow-xs font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90'
                }`}
                title={formatState.orderedList ? 'Numbered List (Active - click to deselect)' : 'Numbered List'}
              >
                <ListOrdered className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleBlockTag('blockquote');
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  toggleBlockTag('blockquote');
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer shrink-0 border ${
                  formatState.blockquote
                    ? 'bg-pink-600 text-white border-pink-600 shadow-xs font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/90'
                }`}
                title={formatState.blockquote ? 'Quote (Active - click to deselect)' : 'Callout Quote (Blockquote)'}
              >
                <Quote className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertDivider();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  insertDivider();
                }}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-700 bg-white border border-slate-200/90 transition-colors cursor-pointer shrink-0"
                title="Insert Divider Line"
              >
                <Minus className="w-4 h-4" />
              </button>

              {/* Insert Hyperlink Tool */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  promptInsertLink();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  promptInsertLink();
                }}
                className="p-2 hover:bg-pink-50 hover:text-pink-700 rounded-xl text-slate-700 bg-white border border-slate-200/90 transition-colors cursor-pointer shrink-0"
                title="Insert Link / Website URL (Opens in New Tab)"
              >
                <Link2 className="w-4 h-4" />
              </button>

              <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />

              {/* Dedicated Clear Formatting / Deselect All Button */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  clearFormatting();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  clearFormatting();
                }}
                className="px-2.5 py-1.5 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl bg-white border border-slate-200/90 hover:border-rose-200 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-semibold"
                title="Clear all formatting / Deselect styles from selection"
              >
                <RemoveFormatting className="w-3.5 h-3.5 text-rose-500" />
                <span>Clear Format</span>
              </button>
            </div>

            {/* True WYSIWYG ContentEditable Canvas with Auto Selection State Updates */}
            <div
              ref={editorRef}
              contentEditable
              spellCheck="true"
              onKeyUp={updateFormatState}
              onMouseUp={updateFormatState}
              onTouchEnd={updateFormatState}
              onInput={updateFormatState}
              className="w-full min-h-[260px] sm:min-h-[320px] max-h-[50vh] overflow-y-auto px-4 sm:px-6 py-4 rounded-b-2xl border border-slate-200 border-t-0 focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-pink-500 bg-white text-slate-800 text-sm sm:text-base leading-relaxed rich-article-editor shadow-2xs"
              data-placeholder="Start writing your article here... Press Enter for a new line or paragraph. Select text and click Bold, Italic, Highlight, Headings, or Lists. Click any active option again to deselect it anytime!"
            />
          </div>

          {/* Author attribution preview */}
          <div className="p-3 bg-pink-50/50 border border-pink-100 rounded-2xl flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              {currentUserProfile.photoURL ? (
                <img
                  src={currentUserProfile.photoURL}
                  alt={currentUserProfile.displayName}
                  className="w-7 h-7 rounded-full object-cover border border-pink-200"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center text-[10px]">
                  {currentUserProfile.displayName.charAt(0)}
                </div>
              )}
              <span>
                Publishing as <strong className="text-slate-900 font-bold">{currentUserProfile.displayName}</strong>
              </span>
            </div>
            <span className="text-[11px] text-pink-700 font-semibold bg-pink-100/70 px-2 py-0.5 rounded-full">
              Verified Mentor
            </span>
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-pink-200 hover:shadow-lg hover:shadow-pink-300 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? 'Update Article' : 'Publish Article'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
