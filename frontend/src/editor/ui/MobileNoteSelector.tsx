/**
 * frontend/src/editor/ui/MobileNoteSelector.tsx
 * Segmented note type selector strip (F17).
 * Provides one-touch selection between:
 * [TAP] [HOLD] [ROLL] [MINE] [LIFT] [FAKE] [DEL].
 * All touch targets meet WCAG 2.5.5 >= 48px height.
 */

import React from 'react';

export type NoteToolType = 'TAP' | 'HOLD' | 'ROLL' | 'MINE' | 'LIFT' | 'FAKE' | 'DEL';

export interface MobileNoteSelectorProps {
  activeTool: NoteToolType;
  onSelectTool: (tool: NoteToolType) => void;
}

const TOOLS: Array<{ type: NoteToolType; label: string; color: string }> = [
  { type: 'TAP', label: 'TAP', color: '#00A2FF' },
  { type: 'HOLD', label: 'HOLD', color: '#00E676' },
  { type: 'ROLL', label: 'ROLL', color: '#FF54BE' },
  { type: 'MINE', label: 'MINE', color: '#FF3366' },
  { type: 'LIFT', label: 'LIFT', color: '#E0E2EC' },
  { type: 'FAKE', label: 'FAKE', color: '#8A92A6' },
  { type: 'DEL', label: 'DEL', color: '#FF7B00' },
];

export const MobileNoteSelector: React.FC<MobileNoteSelectorProps> = ({
  activeTool,
  onSelectTool,
}) => {
  return (
    <div
      className="note-tools flex items-center justify-between gap-1 px-2 py-1 bg-[#161822] border-t border-[#232738] select-none w-full overflow-x-auto shrink-0"
      data-testid="note-tools"
    >
      {TOOLS.map((t) => {
        const isActive = activeTool === t.type;
        return (
          <button
            key={t.type}
            type="button"
            onClick={() => onSelectTool(t.type)}
            className={`tool-btn flex-1 flex items-center justify-center font-mono font-bold text-xs rounded transition-all min-h-[48px] min-w-[44px] ${
              isActive
                ? 'active bg-[#00A2FF] text-black shadow-md border-2 border-white'
                : 'bg-[#1F2434] text-[#C0C4D6] hover:bg-[#283048] border border-[#33384D]'
            }`}
            data-tool={t.type}
            data-testid={`tool-${t.type.toLowerCase()}`}
            title={`Select ${t.label} placement tool`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
};
