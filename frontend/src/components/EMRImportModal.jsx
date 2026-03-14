import React, { useState, useRef, useCallback } from 'react';
import { X, Camera, Upload, Loader2, AlertCircle } from 'lucide-react';
import { extractPatientFromImageApi, searchDrugsApi } from '../lib/api';

/**
 * EMR Screenshot Import Modal
 *
 * Task 7: Functional OCR import via POST /api/ocr/extract-patient (Claude vision).
 * Accepts PNG, JPG, WEBP via drag-drop or click-to-browse.
 * After extraction, calls onImport(data, drugObjects).
 * The image is not stored — processed and discarded immediately.
 */
export function EMRImportModal({ onClose, onImport, species, t }) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  const processFile = useCallback(async (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('PNG, JPG, WEBP 파일만 지원합니다. / Only PNG, JPG, WEBP files are supported.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('파일 크기가 너무 큽니다 (최대 20 MB). / File too large (max 20 MB).');
      return;
    }

    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);

    try {
      const data = await extractPatientFromImageApi(file);
      if (!data) {
        setError(
          '스크린샷에서 데이터를 추출할 수 없습니다. 양식을 직접 입력해 주세요.\n' +
          'Could not extract data from this screenshot. Please fill in the form manually.'
        );
        setLoading(false);
        return;
      }

      // Resolve current_drugs to drug objects via backend search
      let drugObjects = [];
      if (data.current_drugs?.length) {
        const drugResults = await Promise.all(
          data.current_drugs.map(async (drugName) => {
            const results = await searchDrugsApi(drugName, species || null, 1);
            return results?.[0] ?? null;
          })
        );
        drugObjects = drugResults.filter(Boolean);
      }

      onImport(data, drugObjects);
      onClose();
    } catch {
      setError(
        '스크린샷에서 데이터를 추출할 수 없습니다. 양식을 직접 입력해 주세요.\n' +
        'Could not extract data from this screenshot. Please fill in the form manually.'
      );
    } finally {
      setLoading(false);
    }
  }, [onImport, onClose, species]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-slate-500" />
            <h3 className="text-base font-semibold text-slate-800">
              {t?.fullSystem?.importModalTitle || 'EMR 스크린샷 가져오기'}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Upload area */}
        <div
          onClick={() => !loading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
            loading
              ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
              : dragOver
              ? 'border-indigo-400 bg-indigo-50'
              : previewUrl
              ? 'border-slate-300 bg-slate-50'
              : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
          }`}
        >
          {loading ? (
            <>
              <Loader2 size={32} className="text-slate-400 animate-spin" />
              <p className="text-sm text-slate-500 text-center">
                AI가 스크린샷을 분석 중입니다…<br />
                <span className="text-[12px] text-slate-400">Analyzing screenshot with AI…</span>
              </p>
            </>
          ) : previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-32 max-w-full rounded-lg object-contain shadow-sm"
              />
              <p className="text-[12px] text-slate-400">다른 이미지를 클릭하여 변경 / Click to change</p>
            </>
          ) : (
            <>
              <Upload size={28} className="text-slate-300" />
              <div className="text-center">
                <p className="text-sm text-slate-600 font-medium">
                  {t?.fullSystem?.importDragDrop || '파일을 이곳에 드롭하거나 클릭하여 업로드'}
                </p>
                <p className="text-[12px] text-slate-400 mt-1">PNG, JPG, WEBP · 최대 20 MB</p>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Error message */}
        {error && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-700 leading-relaxed whitespace-pre-line">{error}</p>
          </div>
        )}

        <p className="mt-4 text-[11px] text-slate-400 text-center leading-relaxed">
          {t?.fullSystem?.importModalDesc ||
            '이미지는 분석 후 즉시 삭제됩니다. 저장되지 않습니다.\nThe image is processed and discarded immediately — never stored.'}
        </p>

        <button
          onClick={onClose}
          disabled={loading}
          className="mt-4 w-full px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          {t?.fullSystem?.importClose || '닫기'}
        </button>
      </div>
    </div>
  );
}
