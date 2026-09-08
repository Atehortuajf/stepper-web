/**
 * frontend/src/editor/ui/TimingModal.tsx
 * Modal dialog for BPM & Timing adjustments (F16 / Shift+T).
 * Allows modifying initial BPM, offset in seconds, and time signature.
 */

import React, { useState } from 'react';

export interface TimingModalProps {
  isOpen: boolean;
  initialBpm: number;
  initialOffset: number;
  initialTimeSignature?: { numerator: number; denominator: number };
  onSave: (bpm: number, offset: number, timeSignature: { numerator: number; denominator: number }) => void;
  onClose: () => void;
}

interface TimingFormProps {
  initialBpm: number;
  initialOffset: number;
  initialTimeSignature: { numerator: number; denominator: number };
  onSave: (bpm: number, offset: number, timeSignature: { numerator: number; denominator: number }) => void;
  onClose: () => void;
}

const TimingModalForm: React.FC<TimingFormProps> = ({
  initialBpm,
  initialOffset,
  initialTimeSignature,
  onSave,
  onClose,
}) => {
  const [bpm, setBpm] = useState<string>(initialBpm.toString());
  const [offset, setOffset] = useState<string>(initialOffset.toString());
  const [numerator, setNumerator] = useState<string>(initialTimeSignature.numerator.toString());
  const [denominator, setDenominator] = useState<string>(initialTimeSignature.denominator.toString());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBpm = parseFloat(bpm);
    const parsedOffset = parseFloat(offset);
    const parsedNum = parseInt(numerator, 10);
    const parsedDen = parseInt(denominator, 10);

    if (!isNaN(parsedBpm) && parsedBpm > 0 && !isNaN(parsedOffset)) {
      onSave(parsedBpm, parsedOffset, {
        numerator: !isNaN(parsedNum) && parsedNum > 0 ? parsedNum : 4,
        denominator: !isNaN(parsedDen) && parsedDen > 0 ? parsedDen : 4,
      });
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {/* Initial BPM */}
      <div>
        <label htmlFor="timing-bpm" className="block text-[11px] text-[#8A92A6] font-semibold mb-1">
          Song Tempo / Initial BPM:
        </label>
        <input
          id="timing-bpm"
          type="number"
          step="0.001"
          min="10"
          max="1000"
          value={bpm}
          onChange={(e) => setBpm(e.target.value)}
          className="w-full px-3 py-2 bg-[#0C0D12] border border-[#2A3144] focus:border-[#00E5FF] rounded text-white font-mono text-sm focus:outline-hidden"
          data-testid="input-bpm"
          required
        />
      </div>

      {/* Audio Offset */}
      <div>
        <label htmlFor="timing-offset" className="block text-[11px] text-[#8A92A6] font-semibold mb-1">
          Audio Offset (Seconds, negative means audio starts before beat 0):
        </label>
        <input
          id="timing-offset"
          type="number"
          step="0.0001"
          value={offset}
          onChange={(e) => setOffset(e.target.value)}
          className="w-full px-3 py-2 bg-[#0C0D12] border border-[#2A3144] focus:border-[#00E5FF] rounded text-white font-mono text-sm focus:outline-hidden"
          data-testid="input-offset"
          required
        />
      </div>

      {/* Time Signature */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="timing-num" className="block text-[11px] text-[#8A92A6] font-semibold mb-1">
            Beats per Measure:
          </label>
          <input
            id="timing-num"
            type="number"
            min="1"
            max="16"
            value={numerator}
            onChange={(e) => setNumerator(e.target.value)}
            className="w-full px-3 py-2 bg-[#0C0D12] border border-[#2A3144] focus:border-[#00E5FF] rounded text-white font-mono text-sm focus:outline-hidden"
            data-testid="input-numerator"
            required
          />
        </div>

        <div>
          <label htmlFor="timing-den" className="block text-[11px] text-[#8A92A6] font-semibold mb-1">
            Note Value (Denominator):
          </label>
          <input
            id="timing-den"
            type="number"
            min="1"
            max="16"
            value={denominator}
            onChange={(e) => setDenominator(e.target.value)}
            className="w-full px-3 py-2 bg-[#0C0D12] border border-[#2A3144] focus:border-[#00E5FF] rounded text-white font-mono text-sm focus:outline-hidden"
            data-testid="input-denominator"
            required
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-3 border-t border-[#232738]">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded bg-[#232738] hover:bg-[#33384D] text-[#C0C4D6] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded bg-[#00E5FF] hover:bg-[#00c8df] text-black font-bold transition-colors"
          data-testid="btn-save-timing"
        >
          Apply Timing
        </button>
      </div>
    </form>
  );
};

export const TimingModal: React.FC<TimingModalProps> = ({
  isOpen,
  initialBpm,
  initialOffset,
  initialTimeSignature = { numerator: 4, denominator: 4 },
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none"
      data-testid="timing-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-[#161822] border-2 border-[#363C52] rounded shadow-2xl p-5 text-[#E0E2EC] font-mono text-xs"
        data-testid="timing-modal"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#232738]">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00E5FF]" />
            BPM & Timing Adjustments (Shift+T)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded bg-[#232738] hover:bg-[#33384D] text-[#8A92A6] hover:text-white transition-colors"
            data-testid="btn-close-timing"
          >
            ✕
          </button>
        </div>

        <TimingModalForm
          key={`${initialBpm}-${initialOffset}-${initialTimeSignature.numerator}/${initialTimeSignature.denominator}`}
          initialBpm={initialBpm}
          initialOffset={initialOffset}
          initialTimeSignature={initialTimeSignature}
          onSave={onSave}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
