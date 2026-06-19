import { useRef, useState, useCallback, DragEvent, ChangeEvent } from 'react';
import clsx from 'clsx';
import { UploadCloud, FileText, Loader2, CheckCircle2, XCircle } from 'lucide-react';

type Status = 'idle' | 'uploading' | 'parsing' | 'parsed' | 'failed';

interface UploadZoneProps {
  status: Status;
  fileName?: string;
  errorMessage?: string;
  confidenceScore?: number;
  onUpload: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_MB = 10;

export default function UploadZone({
  status,
  fileName,
  errorMessage,
  confidenceScore,
  onUpload,
  disabled,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const validate = (file: File): string | null => {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'pdf' && ext !== 'docx') {
      return 'Only PDF and DOCX files are supported.';
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return `File must be under ${MAX_MB} MB.`;
    }
    return null;
  };

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) {
        // surface via parent by calling onUpload with a synthetic rejection
        onUpload(file); // parent will receive and handle validation in API call
        return;
      }
      onUpload(file);
    },
    [onUpload],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // reset so same file can be re-selected
  };

  const busy = status === 'uploading' || status === 'parsing';

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={clsx(
          'card card-pad flex flex-col items-center justify-center text-center cursor-pointer transition',
          'min-h-[180px]',
          dragging && 'border-brand-400 bg-brand-50',
          busy && 'opacity-60 cursor-not-allowed',
          !dragging && !busy && 'hover:border-slate-300 hover:bg-slate-50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={onChange}
          className="hidden"
          disabled={disabled || busy}
        />

        {status === 'idle' && (
          <>
            <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
              <UploadCloud size={22} />
            </div>
            <div className="text-sm font-medium text-slate-900">
              Drop your resume here, or click to browse
            </div>
            <div className="text-xs text-slate-500 mt-1">
              PDF or DOCX · max {MAX_MB} MB
            </div>
          </>
        )}

        {status === 'uploading' && (
          <>
            <Loader2 size={28} className="text-brand-600 animate-spin mb-3" />
            <div className="text-sm font-medium text-slate-900">Uploading…</div>
            <div className="text-xs text-slate-500 mt-1">{fileName}</div>
          </>
        )}

        {status === 'parsing' && (
          <>
            <Loader2 size={28} className="text-brand-600 animate-spin mb-3" />
            <div className="text-sm font-medium text-slate-900">AI is parsing your resume…</div>
            <div className="text-xs text-slate-500 mt-1">
              This usually takes 5–15 seconds
            </div>
          </>
        )}

        {status === 'parsed' && (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 size={22} />
            </div>
            <div className="text-sm font-medium text-slate-900">Resume parsed</div>
            <div className="text-xs text-slate-500 mt-1">
              {fileName}
              {confidenceScore !== undefined &&
                ` · confidence ${(confidenceScore * 100).toFixed(0)}%`}
            </div>
            <div className="text-xs text-brand-600 mt-2 font-medium">
              Drop a new file to re-upload
            </div>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
              <XCircle size={22} />
            </div>
            <div className="text-sm font-medium text-slate-900">Parse failed</div>
            <div className="text-xs text-red-600 mt-1 max-w-xs">
              {errorMessage ?? 'Unknown error'}
            </div>
            <div className="text-xs text-brand-600 mt-2 font-medium">
              Try again with a different file
            </div>
          </>
        )}
      </div>

      {(status === 'parsed' || status === 'failed') && fileName && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FileText size={12} />
          <span>{fileName}</span>
        </div>
      )}
    </div>
  );
}