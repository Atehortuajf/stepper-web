/**
 * frontend/src/editor/ui/MobileTouchPad.tsx
 * High-contrast on-screen directional touch pad (F17).
 * Features 4 tactile directional buttons (Left, Down, Up, Right) >= 48x48 px,
 * zero element overlap, and Player 1 / Player 2 bank toggle switch for Doubles mode.
 */

import React, { useState } from 'react';

export interface MobileTouchPadProps {
  onPadPress: (colIndex: number, keyNumber: number) => void;
  isDoubles?: boolean;
}

export const MobileTouchPad: React.FC<MobileTouchPadProps> = ({
  onPadPress,
  isDoubles = false,
}) => {
  const [activeBank, setActiveBank] = useState<'P1' | 'P2'>('P1');
  const [pressedCol, setPressedCol] = useState<number | null>(null);

  const bankOffset = isDoubles && activeBank === 'P2' ? 4 : 0;

  const handleTouch = (baseCol: number, keyNum: number) => {
    const targetCol = baseCol + bankOffset;
    setPressedCol(targetCol);
    onPadPress(targetCol, keyNum);
    setTimeout(() => setPressedCol(null), 150);
  };

  return (
    <div
      className="touch-pad flex flex-col items-center justify-center p-2 bg-[#12141D] border-t border-[#232738] select-none w-full shrink-0"
      data-testid="touch-pad"
    >
      {/* Doubles Dual-Bank Switcher (P1 / P2) */}
      {isDoubles && (
        <div
          className="flex items-center justify-center gap-2 mb-1.5 w-full max-w-[360px]"
          data-testid="mobile-doubles-toggle"
        >
          <button
            type="button"
            onClick={() => setActiveBank('P1')}
            className={`flex-1 py-1 text-xs font-mono font-bold rounded border transition-colors min-h-[48px] ${
              activeBank === 'P1'
                ? 'bg-[#00E5FF] text-black border-[#00E5FF]'
                : 'bg-[#1F2434] text-[#8A92A6] border-[#363C52]'
            }`}
            data-testid="bank-p1"
          >
            P1 (Cols 1–4)
          </button>
          <button
            type="button"
            onClick={() => setActiveBank('P2')}
            className={`flex-1 py-1 text-xs font-mono font-bold rounded border transition-colors min-h-[48px] ${
              activeBank === 'P2'
                ? 'bg-[#FF54BE] text-black border-[#FF54BE]'
                : 'bg-[#1F2434] text-[#8A92A6] border-[#363C52]'
            }`}
            data-testid="bank-p2"
          >
            P2 (Cols 5–8)
          </button>
        </div>
      )}

      {/* 4 Tactile Directional Touch Arrow Buttons */}
      <div className="flex items-center justify-center gap-2 w-full max-w-[400px]">
        {/* Left Arrow */}
        <button
          type="button"
          onPointerDown={() => handleTouch(0, 1)}
          className={`touch-arrow flex-1 flex items-center justify-center rounded-lg border-2 font-bold text-2xl transition-all cursor-pointer ${
            pressedCol === 0 + bankOffset
              ? 'border-[#00A2FF] bg-[#283048] text-[#00A2FF] scale-95'
              : 'border-[#363C52] bg-[#1F2434] text-white hover:border-[#5A627A]'
          }`}
          style={{ height: '72px', minWidth: '48px', minHeight: '48px', maxWidth: '90px' }}
          data-testid="pad-left"
          data-key="1"
          aria-label="Tap Left Arrow"
        >
          &larr;
        </button>

        {/* Down Arrow */}
        <button
          type="button"
          onPointerDown={() => handleTouch(1, 2)}
          className={`touch-arrow flex-1 flex items-center justify-center rounded-lg border-2 font-bold text-2xl transition-all cursor-pointer ${
            pressedCol === 1 + bankOffset
              ? 'border-[#00A2FF] bg-[#283048] text-[#00A2FF] scale-95'
              : 'border-[#363C52] bg-[#1F2434] text-white hover:border-[#5A627A]'
          }`}
          style={{ height: '72px', minWidth: '48px', minHeight: '48px', maxWidth: '90px' }}
          data-testid="pad-down"
          data-key="2"
          aria-label="Tap Down Arrow"
        >
          &darr;
        </button>

        {/* Up Arrow */}
        <button
          type="button"
          onPointerDown={() => handleTouch(2, 3)}
          className={`touch-arrow flex-1 flex items-center justify-center rounded-lg border-2 font-bold text-2xl transition-all cursor-pointer ${
            pressedCol === 2 + bankOffset
              ? 'border-[#00A2FF] bg-[#283048] text-[#00A2FF] scale-95'
              : 'border-[#363C52] bg-[#1F2434] text-white hover:border-[#5A627A]'
          }`}
          style={{ height: '72px', minWidth: '48px', minHeight: '48px', maxWidth: '90px' }}
          data-testid="pad-up"
          data-key="3"
          aria-label="Tap Up Arrow"
        >
          &uarr;
        </button>

        {/* Right Arrow */}
        <button
          type="button"
          onPointerDown={() => handleTouch(3, 4)}
          className={`touch-arrow flex-1 flex items-center justify-center rounded-lg border-2 font-bold text-2xl transition-all cursor-pointer ${
            pressedCol === 3 + bankOffset
              ? 'border-[#00A2FF] bg-[#283048] text-[#00A2FF] scale-95'
              : 'border-[#363C52] bg-[#1F2434] text-white hover:border-[#5A627A]'
          }`}
          style={{ height: '72px', minWidth: '48px', minHeight: '48px', maxWidth: '90px' }}
          data-testid="pad-right"
          data-key="4"
          aria-label="Tap Right Arrow"
        >
          &rarr;
        </button>
      </div>
    </div>
  );
};
