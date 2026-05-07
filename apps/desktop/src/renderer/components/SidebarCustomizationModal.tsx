import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  GripVertical,
  Lock,
} from 'lucide-react';
import {
  SidebarPreferences,
  getSidebarPreferences,
  saveSidebarPreferences,
  resetSidebarPreferences,
} from '../lib/sidebarPreferences';

export interface CustomizableItem {
  id: string;
  label: string;
  group: 'main' | 'utility';
  protected?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: CustomizableItem[];
  onApply: (prefs: SidebarPreferences) => void;
}

const arrayMove = <T,>(arr: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

export const SidebarCustomizationModal: React.FC<Props> = ({ open, onClose, items, onApply }) => {
  const initial = useMemo(() => getSidebarPreferences(), [open]);
  const [hidden, setHidden] = useState<string[]>(initial.hidden);
  const [order, setOrder] = useState<string[]>(() => {
    if (initial.order.length === 0) return items.map((i) => i.id);
    const itemIds = items.map((i) => i.id);
    const ordered = initial.order.filter((id) => itemIds.includes(id));
    const missing = itemIds.filter((id) => !ordered.includes(id));
    return [...ordered, ...missing];
  });

  // Re-sync state whenever the modal opens or items change
  useEffect(() => {
    if (!open) return;
    const fresh = getSidebarPreferences();
    setHidden(fresh.hidden);
    const itemIds = items.map((i) => i.id);
    const ordered = fresh.order.length === 0 ? itemIds : fresh.order.filter((id) => itemIds.includes(id));
    const missing = itemIds.filter((id) => !ordered.includes(id));
    setOrder([...ordered, ...missing]);
  }, [open, items]);

  if (!open) return null;

  const orderedItems = order
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is CustomizableItem => Boolean(item));

  const toggleHidden = (id: string, isProtected: boolean) => {
    if (isProtected) return;
    setHidden((current) => (current.includes(id) ? current.filter((v) => v !== id) : [...current, id]));
  };

  const move = (id: string, direction: -1 | 1) => {
    const idx = order.indexOf(id);
    if (idx === -1) return;
    setOrder((current) => arrayMove(current, idx, idx + direction));
  };

  const handleSave = () => {
    const prefs: SidebarPreferences = {
      hidden: hidden.filter((id) => {
        const item = items.find((entry) => entry.id === id);
        return item && !item.protected;
      }),
      order,
    };
    saveSidebarPreferences(prefs);
    onApply(prefs);
    onClose();
  };

  const handleReset = () => {
    resetSidebarPreferences();
    setHidden([]);
    setOrder(items.map((i) => i.id));
  };

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggingId(id);
    try {
      event.dataTransfer.setData('text/plain', id);
      event.dataTransfer.effectAllowed = 'move';
    } catch {}
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, id: string) => {
    if (!draggingId || draggingId === id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) setDragOverId(id);
  };

  const handleDragLeave = (id: string) => {
    if (dragOverId === id) setDragOverId(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    setOrder((current) => {
      const fromIdx = current.indexOf(draggingId);
      const toIdx = current.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return current;
      const next = [...current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const renderRow = (item: CustomizableItem, index: number, total: number) => {
    const isHidden = hidden.includes(item.id);
    const isProtected = !!item.protected;
    const isDragging = draggingId === item.id;
    const isDragTarget = dragOverId === item.id && draggingId !== item.id;
    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragOver={(e) => handleDragOver(e, item.id)}
        onDragLeave={() => handleDragLeave(item.id)}
        onDrop={(e) => handleDrop(e, item.id)}
        onDragEnd={handleDragEnd}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
          isDragging
            ? 'opacity-40 border-dashed border-blue-300 dark:border-blue-500/40'
            : isDragTarget
              ? 'border-blue-400 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-500/10 ring-2 ring-blue-200 dark:ring-blue-500/20'
              : isHidden
                ? 'border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/0 opacity-60'
                : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/5'
        }`}
      >
        <GripVertical size={14} className="text-gray-400 dark:text-white/40 shrink-0 cursor-grab active:cursor-grabbing" />
        <span className="flex-1 text-[13px] font-medium text-gray-800 dark:text-[#F5F5F5] truncate">
          {item.label}
        </span>
        {isProtected ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
            <Lock size={11} /> Required
          </span>
        ) : (
          <button
            type="button"
            onClick={() => toggleHidden(item.id, isProtected)}
            className={`p-1.5 rounded-lg transition-colors ${
              isHidden
                ? 'text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10'
            }`}
            title={isHidden ? 'Show in sidebar' : 'Hide from sidebar'}
          >
            {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => move(item.id, -1)}
            disabled={index === 0}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move up"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => move(item.id, 1)}
            disabled={index === total - 1}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move down"
          >
            <ArrowDown size={14} />
          </button>
        </div>
      </div>
    );
  };

  const mainItems = orderedItems.filter((item) => item.group === 'main');
  const utilityItems = orderedItems.filter((item) => item.group === 'utility');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-[#151515] rounded-3xl shadow-2xl border border-gray-100 dark:border-white/10 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-white/5">
          <div>
            <h2 className="text-[18px] font-bold text-gray-900 dark:text-white">Customize sidebar</h2>
            <p className="text-[12px] text-gray-500 dark:text-[#A0A0A0] mt-1">
              Drag the grip handle to reorder, or click the eye to hide an item.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">Main navigation</p>
            <div className="space-y-2">
              {mainItems.length === 0 ? (
                <p className="text-[12px] text-gray-400 px-1">No main items.</p>
              ) : (
                mainItems.map((item) => {
                  const overallIndex = order.indexOf(item.id);
                  return renderRow(item, overallIndex, order.length);
                })
              )}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">Utility</p>
            <div className="space-y-2">
              {utilityItems.length === 0 ? (
                <p className="text-[12px] text-gray-400 px-1">No utility items.</p>
              ) : (
                utilityItems.map((item) => {
                  const overallIndex = order.indexOf(item.id);
                  return renderRow(item, overallIndex, order.length);
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-100 dark:border-white/5">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 text-[12px] font-medium text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
          >
            <RotateCcw size={12} />
            Reset to default
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[13px] font-medium text-gray-600 dark:text-[#A0A0A0] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-[#0033CC] hover:bg-[#0044EE] text-white text-[13px] font-bold transition-colors"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
