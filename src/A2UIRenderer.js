import React, { useState } from 'react';
import { 
  Plus, Minus, Play, Square, CheckSquare, Square as SquareIcon, 
  ToggleLeft, ToggleRight, X, Edit2 
} from 'lucide-react';

const COMPONENTS = {
  // 1. HERO STAT (Safe handling for missing data)
  HeroStat: ({ label, value_key, data }) => {
    const value = data && data[value_key] !== undefined ? data[value_key] : 0;
    return (
      <div className="text-center p-8 bg-white rounded-3xl shadow-sm border border-slate-100 mb-4 animate-in zoom-in-50">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{label}</div>
        <div className="text-6xl font-black text-slate-900 tracking-tighter">{value}</div>
      </div>
    );
  },

  // 2. ACTION BUTTON
  ActionButton: ({ label, action, payload, onAction, variant }) => {
    const isDestructive = variant === 'destructive';
    return (
      <button 
        onClick={() => onAction(action, payload)}
        className={`w-full py-5 rounded-2xl font-bold text-lg shadow-lg transform active:scale-95 transition-all mb-3 flex items-center justify-center gap-2
          ${isDestructive ? 'bg-red-50 text-red-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
      >
        {action === 'START_TIMER' && <Play size={20} fill="currentColor"/>}
        {action === 'STOP_TIMER' && <Square size={20} fill="currentColor"/>}
        {action === 'INCREMENT_COUNT' && <Plus size={24} />}
        {label}
      </button>
    );
  },

  // 3. CHECKLIST (The Fix: Default key to 'items')
  Checklist: ({ items_key, data, onAction }) => {
    // CRITICAL FIX: Default to 'items' if items_key is missing
    const safeKey = items_key || 'items';
    const items = (data && data[safeKey]) ? data[safeKey] : [];
    
    const [newItem, setNewItem] = useState('');
    const [editingIndex, setEditingIndex] = useState(null);
    const [editValue, setEditValue] = useState('');

    const saveEdit = (index) => {
      onAction('EDIT_CHECKLIST_ITEM', { key: safeKey, index, value: editValue });
      setEditingIndex(null);
    };

    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Input Area */}
        <div className="p-4 border-b border-slate-50 flex gap-2">
          <input 
            className="flex-1 bg-slate-50 rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Add item..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newItem.trim()) {
                onAction('ADD_CHECKLIST_ITEM', { key: safeKey, value: newItem });
                setNewItem('');
              }
            }}
          />
          <button 
            onClick={() => {
              if (newItem.trim()) {
                onAction('ADD_CHECKLIST_ITEM', { key: safeKey, value: newItem });
                setNewItem('');
              }
            }}
            className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* List Items */}
        <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
          {items.map((item, idx) => (
            <div key={idx} className="p-4 flex items-center gap-3 group hover:bg-slate-50 transition-colors cursor-pointer" 
                 onClick={() => { if (editingIndex !== idx) onAction('TOGGLE_CHECKLIST_ITEM', { key: safeKey, index: idx }); }}>
              
              {item.checked ? <CheckSquare className="text-green-500 shrink-0" size={24} /> : <SquareIcon className="text-slate-300 shrink-0" size={24} />}

              {editingIndex === idx ? (
                <div className="flex-1 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <input 
                    className="flex-1 bg-white border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none"
                    value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(idx)}
                  />
                  <button onClick={() => saveEdit(idx)} className="text-blue-600 text-xs font-bold">SAVE</button>
                </div>
              ) : (
                <span className={`flex-1 font-medium select-none ${item.checked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.label}</span>
              )}

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); setEditingIndex(idx); setEditValue(item.label); }} className="text-slate-300 hover:text-blue-500 p-2"><Edit2 size={16} /></button>
                <button onClick={(e) => { e.stopPropagation(); onAction('DELETE_CHECKLIST_ITEM', { key: safeKey, index: idx }); }} className="text-slate-300 hover:text-red-500 p-2"><X size={16} /></button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">List is empty</div>}
        </div>
      </div>
    );
  }
};

const A2UIRenderer = ({ blueprint, data, onAction }) => {
  if (!blueprint) return null;
  return (
    <div className="w-full max-w-md mx-auto pb-32 px-4 space-y-4">
      {blueprint.map((block, index) => {
        const Component = COMPONENTS[block.type];
        if (!Component) return <div key={index} className="text-red-500 text-xs">Unknown Block: {block.type}</div>;
        return <Component key={index} {...block} data={data} onAction={onAction} />;
      })}
    </div>
  );
};

export default A2UIRenderer;
