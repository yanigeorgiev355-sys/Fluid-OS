import React from 'react';
import * as Icons from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

// --- ATOMIC COMPONENTS (The "Lego Bricks") ---
const COMPONENTS = {
  Header: ({ label, icon }) => {
    const Icon = icon && Icons[icon] ? Icons[icon] : Icons.Sparkles;
    return (
      <div className="col-span-full text-center py-6 animate-in fade-in zoom-in duration-500">
        <div className="inline-flex p-4 bg-gradient-to-tr from-blue-600 to-purple-600 text-white rounded-3xl shadow-lg mb-4">
          <Icon size={32} />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">{label}</h1>
      </div>
    );
  },

  Card: ({ title, children, renderBlocks }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-4 flex flex-col h-full animate-in zoom-in-95">
      {title && <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 border-b border-slate-50 pb-3">{title}</h3>}
      <div className="flex-1">
        {renderBlocks(children)}
      </div>
    </div>
  ),

  Grid: ({ columns, children, renderBlocks }) => (
    <div className={`grid grid-cols-1 md:grid-cols-${columns || 2} gap-4 mb-4 items-start animate-in slide-in-from-bottom-4`}>
      {renderBlocks(children)}
    </div>
  ),

  Stat: ({ label, value, icon }) => {
    if (value === undefined) return null;
    return (
      <div className="group relative overflow-hidden bg-slate-50 p-6 rounded-2xl mb-4">
        <div className="flex flex-col text-left">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</span>
          <span className="text-5xl font-extrabold text-blue-600 tracking-tighter">{value}</span>
        </div>
      </div>
    );
  },

  Chart: ({ data }) => {
    if (!data || !Array.isArray(data) || data.length < 2) return <div className="text-slate-400 text-sm text-center py-10">Add more data to see the trend.</div>; 
    const plotKey = Object.keys(data[0]).find(k => typeof data[0][k] === 'number');
    if (!plotKey) return null;

    return (
      <div className="h-56 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="timestamp" hide />
            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} itemStyle={{ color: '#3b82f6' }} />
            <Area type="monotone" dataKey={plotKey} stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  },

  // --- THE SMART DATA LIST ---
  // Automatically detects "Badges" if a 2nd string is present (Abstract Logic, not hardcoded)
  DataList: ({ data, dataKey, onAction }) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return <div className="p-6 text-center text-slate-400 text-sm bg-slate-50 rounded-2xl">No history yet. Start tracking!</div>;
    }
    return (
      <div className="rounded-2xl border border-slate-100 overflow-hidden">
        {data.slice().reverse().map((item, i) => {
           const originalIndex = data.length - 1 - i; 
           const numKey = Object.keys(item).find(k => typeof item[k] === 'number');
           const stringKeys = Object.keys(item).filter(k => typeof item[k] === 'string' && k !== 'timestamp');
           const mainStrKey = stringKeys[0];
           const badgeKey = stringKeys[1]; // If a second string exists, it becomes a badge automatically
           
           return (
             <div key={originalIndex} className="p-4 border-b border-slate-50 last:border-0 flex flex-col hover:bg-slate-50 transition-colors group relative">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-800 capitalize">{item[mainStrKey] || 'Entry'}</span>
                  <span className="font-extrabold text-blue-600 text-lg">{item[numKey] !== undefined ? item[numKey] : ''}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">{item.timestamp}</span>
                    {badgeKey && item[badgeKey] && (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
                        {item[badgeKey]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 bottom-2 bg-white/80 backdrop-blur-sm p-1 rounded-full shadow-sm">
                    <button onClick={() => onAction(JSON.stringify({ tool: 'edit_in_list', payload: { key: dataKey, index: originalIndex, field: numKey || mainStrKey } }))} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-all"><Icons.Edit2 size={14}/></button>
                    <button onClick={() => onAction(JSON.stringify({ tool: 'delete_from_list', payload: { key: dataKey, index: originalIndex } }))} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><Icons.Trash2 size={14}/></button>
                  </div>
                </div>
             </div>
           );
        })}
      </div>
    );
  },

  // --- NEW: THE DROPDOWN COMPONENT ---
  Select: ({ id, label, options, value, onInputChange }) => (
    <div className="mb-4 text-left">
      {label && <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">{label}</label>}
      <div className="relative">
        <select 
          value={value || ''}
          onChange={(e) => onInputChange(id, e.target.value)}
          className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-medium text-slate-700 appearance-none cursor-pointer"
        >
          <option value="" disabled>Select...</option>
          {options && options.map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
        <Icons.ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
      </div>
    </div>
  ),

  Input: ({ id, label, placeholder, value, onInputChange }) => (
    <div className="mb-4 text-left">
      {label && <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">{label}</label>}
      <input 
        type="text" 
        value={value || ''}
        onChange={(e) => onInputChange(id, e.target.value)}
        placeholder={placeholder || "Type here..."}
        className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-medium text-slate-700"
      />
    </div>
  ),

  Btn: ({ label, onClick, variant, icon }) => {
    const Icon = icon && Icons[icon] ? Icons[icon] : null;
    const baseClass = "relative w-full py-4 px-6 rounded-2xl font-bold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 mb-3 shadow-md";
    const variants = {
      primary: "bg-slate-900 text-white hover:bg-slate-800",
      gradient: "bg-gradient-to-r from-blue-600 to-purple-600 text-white",
      outline: "bg-white text-slate-700 border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50",
      ghost: "bg-transparent text-slate-500 hover:bg-slate-100 shadow-none",
    };
    return (
      <button onClick={onClick} className={`${baseClass} ${variants[variant] || variants.outline}`}>
        {Icon && <Icon size={18} />}
        {label}
      </button>
    );
  },

  Text: ({ label, variant }) => {
    if (!label) return null;
    return <p className={`text-center my-4 ${variant === 'caption' ? 'text-xs text-slate-400 uppercase tracking-widest' : 'text-slate-500 text-sm'}`}>{label}</p>;
  },

  Divider: () => <div className="col-span-full h-px bg-slate-200 my-6 mx-4" />
};

const A2UIRenderer = ({ blueprint, onAction, onInputChange, formState }) => {
  if (!blueprint || !blueprint.blocks) return <div className="text-center p-8 text-slate-400">Dreaming up UI...</div>;

  const renderBlocks = (blocksToRender) => {
    if (!blocksToRender) return null;
    return blocksToRender.map((block, index) => {
      const Component = COMPONENTS[block.t] || COMPONENTS.Text;
      return (
        <Component 
          key={index} 
          {...block} 
          value={block.t === 'Input' || block.t === 'Select' ? formState[block.id] : block.value} 
          onInputChange={onInputChange}
          onAction={onAction} 
          onClick={block.onClick ? () => onAction(block.onClick) : undefined}
          renderBlocks={renderBlocks} 
        />
      );
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto pb-32 px-4">
      {renderBlocks(blueprint.blocks)}
    </div>
  );
};

export default A2UIRenderer;
