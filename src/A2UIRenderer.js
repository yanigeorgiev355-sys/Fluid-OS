import React from 'react';
import * as Icons from 'lucide-react';

const COMPONENTS = {
  Header: ({ label, icon, variant }) => {
    const Icon = icon && Icons[icon] ? Icons[icon] : Icons.Sparkles;
    return (
      <div className="text-center py-6 animate-in fade-in zoom-in duration-500">
        <div className="inline-flex p-4 bg-gradient-to-tr from-blue-600 to-purple-600 text-white rounded-3xl shadow-lg mb-4">
          <Icon size={32} />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">{label}</h1>
      </div>
    );
  },

  Stat: ({ label, value, icon }) => {
    if (!label && !value) return null;
    const Icon = icon && Icons[icon] ? Icons[icon] : null;
    return (
      <div className="group relative overflow-hidden bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-4">
        <div className="flex justify-between items-start">
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</span>
            <span className="text-4xl font-extrabold text-slate-900 tracking-tighter">{value}</span>
          </div>
          {Icon && <div className="text-slate-300"><Icon size={24} /></div>}
        </div>
      </div>
    );
  },

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

  // THE NEW PRO INPUT COMPONENT
  Input: ({ id, label, placeholder, value, onInputChange }) => {
    return (
      <div className="mb-4 text-left animate-in slide-in-from-bottom-2">
        {label && <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">{label}</label>}
        <input 
          type="text" 
          value={value || ''}
          onChange={(e) => onInputChange(id, e.target.value)}
          placeholder={placeholder || "Type here..."}
          className="w-full p-4 bg-white rounded-2xl border-2 border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-medium text-slate-700 shadow-sm"
        />
      </div>
    );
  },

  Text: ({ label, variant }) => {
    if (!label) return null;
    return <p className={`text-center my-4 ${variant === 'caption' ? 'text-xs text-slate-400 uppercase tracking-widest' : 'text-slate-500 text-sm'}`}>{label}</p>;
  },

  Divider: () => <div className="h-px bg-slate-200 my-6 mx-4" />
};

const A2UIRenderer = ({ blueprint, onAction, onInputChange, formState }) => {
  if (!blueprint || !blueprint.blocks) return <div className="text-center p-8 text-slate-400">Dreaming up UI...</div>;

  return (
    <div className="w-full max-w-md mx-auto pb-32 px-2">
      {blueprint.blocks.map((block, index) => {
        const Component = COMPONENTS[block.t] || COMPONENTS.Text;
        return (
          <Component 
            key={index} 
            {...block} 
            // Pass the temporary typed memory to the input
            value={block.t === 'Input' ? formState[block.id] : block.value} 
            onInputChange={onInputChange}
            onClick={block.onClick ? () => onAction(block.onClick) : undefined} 
          />
        );
      })}
    </div>
  );
};

export default A2UIRenderer;
