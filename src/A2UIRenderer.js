import React from 'react';
import * as Icons from 'lucide-react';

const COMPONENTS = {
  Header: ({ label, icon }) => {
    const Icon = icon && Icons[icon] ? Icons[icon] : Icons.Activity;
    return (
      <div className="flex items-center gap-3 mb-6 p-4 bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Icon size={24} /></div>
        <h2 className="text-xl font-bold text-slate-800">{label}</h2>
      </div>
    );
  },

  Stat: ({ label, value, icon }) => {
    const Icon = icon && Icons[icon] ? Icons[icon] : null;
    return (
      <div className="flex items-center p-4 bg-white rounded-xl border border-slate-200 shadow-sm mb-3">
        {Icon && <div className="mr-4 text-slate-400"><Icon size={20} /></div>}
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    );
  },

  Btn: ({ label, onClick, variant }) => (
    <button 
      onClick={onClick}
      className={`w-full py-3 px-4 rounded-xl font-bold text-sm shadow-md transition-transform active:scale-95 mb-3
        ${variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
    >
      {label}
    </button>
  ),

  Text: ({ label }) => (
    <p className="text-slate-600 text-sm text-center my-4">{label}</p>
  ),
  
  Divider: () => <hr className="my-4 border-slate-200" />
};

const A2UIRenderer = ({ blueprint, onAction }) => {
  if (!blueprint || !blueprint.blocks) return <div className="text-center p-8 text-slate-400">Empty App</div>;

  return (
    <div className="w-full max-w-sm mx-auto animate-in slide-in-from-bottom-4 duration-500">
      {blueprint.blocks.map((block, index) => {
        const Component = COMPONENTS[block.t] || COMPONENTS.Text;
        return (
          <Component 
            key={index} 
            {...block} 
            onClick={block.onClick ? () => onAction(block.onClick, "click") : undefined} 
          />
        );
      })}
    </div>
  );
};

export default A2UIRenderer;
