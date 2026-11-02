import React, { useState, useRef, useEffect } from 'react';
import {
  Coffee,
  X,
  Upload,
  Check,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Heart,
  Loader2,
} from 'lucide-react';
import { CoffeeTreatItem, QueryTicket, UserProfile } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { compressImage, uploadDataUrl } from '../../lib/fileUploadHelper';

interface CoffeeTreatModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: QueryTicket;
  /** Kept for compatibility; the server takes the student from the session. */
  userProfile?: UserProfile | null;
  counselorName: string;
  /** Kept for compatibility; the server takes the counselor from the ticket. */
  counselorId?: string;
  onSuccessSubmitted?: (treat?: CoffeeTreatItem) => void;
}

/** Payment details come from server configuration (GET /coffee-treats/config). */
interface CoffeeTreatConfig {
  amount: number;
  paymentMethod: string;
  accountNumber: string;
  accountTitle: string;
  enabled: boolean;
}

export const CoffeeTreatModal: React.FC<CoffeeTreatModalProps> = ({
  isOpen,
  onClose,
  ticket,
  counselorName,
  onSuccessSubmitted,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'JazzCash' | 'EasyPaisa' | 'SadaPay'>('JazzCash');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string>('');
  const [studentNote, setStudentNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMessageText, setErrorMessage] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [config, setConfig] = useState<CoffeeTreatConfig | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    api
      .get<CoffeeTreatConfig>('/coffee-treats/config')
      .then((cfg) => {
        if (cancelled) return;
        setConfig(cfg);
        if (!cfg.enabled) setErrorMessage('Coffee treats are not set up yet. Please try again later.');
      })
      .catch((err) => {
        if (!cancelled) setErrorMessage(errorMessage(err, 'Could not load payment details.'));
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const ACCOUNT_NUMBER = config?.accountNumber || '';
  const ACCOUNT_NAME = config?.accountTitle || '';
  const AMOUNT_LABEL = config ? String(config.amount) : '…';
  const isConfigReady = Boolean(config?.enabled);

  const handleCopyAccount = async () => {
    if (!ACCOUNT_NUMBER) return;
    try {
      await navigator.clipboard.writeText(ACCOUNT_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload an image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('Screenshot size should be under 15MB.');
      return;
    }

    setErrorMessage('');
    setScreenshotFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotFile) {
      setErrorMessage('Please upload your payment screenshot.');
      return;
    }
    if (!isConfigReady) {
      setErrorMessage('Coffee treats are not set up yet. Please try again later.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setUploadProgress(20);

    try {
      // Compress the screenshot before uploading it
      const { dataUrl: compressedDataUrl } = await compressImage(
        screenshotFile,
        1200,
        1200,
        0.75,
        (p) => setUploadProgress(Math.round(p * 0.6))
      );

      setUploadProgress(60);
      const baseName = screenshotFile.name.replace(/\.[^.]+$/, '') || 'payment-screenshot';
      const screenshotUrl = await uploadDataUrl(compressedDataUrl, `${baseName}.jpg`);

      setUploadProgress(85);

      // The server records the treat (amount and account from its config) and
      // notifies the super admins.
      const treat = await api.post<CoffeeTreatItem>('/coffee-treats', {
        ticketId: ticket.id,
        paymentMethod: selectedMethod,
        screenshotUrl,
        screenshotName: screenshotFile.name,
        note: studentNote.trim() || undefined,
      });

      setUploadProgress(100);
      setSubmittedSuccess(true);
      if (onSuccessSubmitted) {
        onSuccessSubmitted(treat);
      }
    } catch (err) {
      console.error('Failed to submit coffee treat:', err);
      setErrorMessage(errorMessage(err, 'Failed to submit screenshot. Please check connection and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Simple & Aesthetic Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center shadow-2xs">
              <Coffee className="w-5 h-5 fill-amber-500/20" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                Buy {counselorName} a Coffee
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Token of appreciation for great guidance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {submittedSuccess ? (
            /* Celebration Success Screen */
            <div className="py-6 text-center space-y-3 animate-scale-up">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-slate-900">
                  Coffee Treat Submitted! ☕🎉
                </h3>
                <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                  Thank you! Your payment screenshot and coffee treat have been submitted. Super Admin will verify and deliver your treat to <strong>{counselorName}</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-left space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Counselor:</span>
                  <span className="font-bold text-slate-800">{counselorName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Amount:</span>
                  <span className="font-bold text-emerald-700">Rs. {AMOUNT_LABEL}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Paid via:</span>
                  <span className="font-semibold text-slate-800">{selectedMethod}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Account:</span>
                  <span className="font-mono text-slate-700">{ACCOUNT_NUMBER}{ACCOUNT_NAME ? ` (${ACCOUNT_NAME})` : ''}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Payment Methods Selection Chips */}
              <div>
                <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                  Choose Payment App:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['JazzCash', 'EasyPaisa', 'SadaPay'] as const).map((method) => {
                    const isSelected = selectedMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setSelectedMethod(method)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-amber-300'
                        }`}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* All Account Details in ONE Consolidated Box as requested */}
              <div className="rounded-2xl bg-gradient-to-br from-amber-50/90 to-orange-50/60 border border-amber-200/90 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-amber-950">
                      Payment Account Details
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 bg-white px-2 py-0.5 rounded-full border border-amber-200">
                      Rs. {AMOUNT_LABEL}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {selectedMethod}
                  </span>
                </div>

                {/* Account Number with 1-click Copy */}
                <div className="p-2.5 rounded-xl bg-white border border-amber-200/80 flex items-center justify-between gap-2 shadow-2xs">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">
                      JazzCash / EasyPaisa / SadaPay Number
                    </span>
                    <span className="text-base sm:text-lg font-mono font-black text-slate-900 tracking-wider">
                      {ACCOUNT_NUMBER}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Account Title & Info */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-slate-600">Account Title:</span>
                    <span className="font-extrabold text-slate-900">{ACCOUNT_NAME}</span>
                  </div>
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-slate-600">Available On:</span>
                    <span className="font-bold text-amber-900">JazzCash, EasyPaisa, SadaPay</span>
                  </div>
                </div>
              </div>

              {/* Upload Screenshot Proof */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Upload Payment Screenshot <span className="text-rose-500">*</span>
                </label>

                {screenshotPreview ? (
                  <div className="relative rounded-2xl border-2 border-emerald-300 bg-emerald-50/30 p-2.5 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={screenshotPreview}
                        alt="Receipt"
                        className="w-12 h-12 rounded-xl object-cover border border-emerald-200 shadow-2xs shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {screenshotFile?.name}
                        </p>
                        <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Ready ({((screenshotFile?.size || 0) / 1024).toFixed(0)} KB)</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveScreenshot}
                      className="px-2 py-1 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-2xl p-3.5 text-center cursor-pointer transition-all hover:bg-amber-50/20 group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-amber-100 text-slate-500 group-hover:text-amber-700 flex items-center justify-center mx-auto mb-1 transition-colors">
                      <Upload className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 group-hover:text-amber-800 transition-colors">
                      Tap to upload {selectedMethod} screenshot
                    </p>
                    <p className="text-[10px] text-slate-400">
                      PNG, JPG, WEBP up to 15MB
                    </p>
                  </div>
                )}
              </div>

              {/* Optional Short Note */}
              <div className="space-y-1">
                <input
                  type="text"
                  value={studentNote}
                  onChange={(e) => setStudentNote(e.target.value)}
                  placeholder={`Thank you ${counselorName}! (Optional note)`}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-400"
                />
              </div>

              {/* Error Message */}
              {errorMessageText && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessageText}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-1 space-y-1.5">
                <button
                  type="submit"
                  disabled={submitting || !screenshotFile || !isConfigReady}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 ${
                    submitting || !screenshotFile || !isConfigReady
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white cursor-pointer active:scale-[0.99] shadow-md shadow-amber-500/10'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting ({uploadProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Coffee className="w-4 h-4 fill-white/20" />
                      <span>Submit Coffee Treat ☕</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="w-full py-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
