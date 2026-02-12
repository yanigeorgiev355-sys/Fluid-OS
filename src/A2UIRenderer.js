import React from 'react';
import * as Icons from 'lucide-react';

// --- STITCH DESIGN SYSTEM COMPONENTS ---

const Header = ({ label, icon, variant }) => {
  const Icon = icon && Icons[icon] ? Icons[icon] : Icons.Sparkles;
  
  if (variant === 'hero') {
    return (
      <div className="text-center py-8 animate-in fade-in zoom-in duration-500">
        <div className="inline-flex p-4 bg-gradient-to-tr from-blue-600 to-purple-600 text-white rounded-3xl shadow-lg mb-4">
          <Icon size={32} />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">{label}</h1>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mb-6 p-1">
      <div className="p-2 bg-blue-100/50 text-blue-600 rounded-xl backdrop-blur-sm"><Icon size={20} /></div>
      <h2 className="text-xl font-bold text-slate-800 tracking-tight">{label}</h2>
    </div>
  );
};

const Stat = ({ label, value, icon, variant }) => {
  if (!label && !value) return null;
  const Icon = icon && Icons[icon] ? Icons[icon] : null;
  
  // Logic: If value looks like a percentage (e.g. "75%"), render a progress bar
  const isProgress = value && typeof value === 'string' && value.includes('%');
  const numericValue = isProgress ? parseInt(value) : 0;

  return (
    <div className="group relative overflow-hidden bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 mb-4">
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</span>
          <span className="text-3xl font-extrabold text-slate-900 tracking-tighter">{value}</span>
        </div>
        {Icon && <div className="text-slate-300 group-hover:text-blue-500 transition-colors"><Icon size={24} /></div>}
      </div>
      
      {/* Auto-generated Progress Bar for percentage values */}
      {isProgress && (
        <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-1000 ease-out" 
            style={{ width: value }}
          />
        </div>
      )}
    </div>
  );
};

const Btn = ({ label, onClick, variant, icon }) => {
  const Icon = icon && Icons[icon] ? Icons[icon] : null;
  
  const baseClass = "relative w-full py-4 px-6 rounded-2xl font-bold text-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 mb-3 group overflow-hidden";
  
  const variants = {
    primary: "bg-slate-900 text-white shadow-lg hover:shadow-xl hover:bg-slate-800",
    gradient: "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-blue-500/25",
    outline: "bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900",
    danger: "bg-red-50 text-red-600 hover:bg-red-100"
  };

  return (
    <button 
      onClick={onClick}
      className={`${baseClass} ${variants[variant] || variants.outline}`}
    >
      {Icon && <Icon size={18} className="transition-transform group-hover:-translate-x-1" />}
      {label}
      {/* Shine effect for gradient buttons */}
      {variant === 'gradient' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
      )}
    </button>
  );
};

// New Input Component (Visual only for now - Phase 2 will wire up the logic)
const Input = ({ label, value }) => {
  return (
    <div className="mb-4">
      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">{label}</label>
      <input 
        type="text" 
        defaultValue={value}
        placeholder="Type here..."
        className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-medium text-slate-700"
      />
    </div>
  );
};

const Text = ({ label, variant }) => {
  if (!label) return null;
  return (
    <p className={`text-center my-4 ${variant === 'caption' ? 'text-xs text-slate-400 uppercase tracking-widest' : 'text-slate-500 text-sm leading-relaxed'}`}>
      {label}
    </p>
  );
};

const Divider = () => <div className="h-px bg-slate-200 my-6 mx-4" />;

const COMPONENTS = {
  Header,
  Stat,
  Btn,
  Text,
  Divider,
  Input 
};

// --- MAIN RENDERER ---

const A2UIRenderer = ({ blueprint, onAction, disabled }) => {
  if (!blueprint || !blueprint.blocks) return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-pulse">
      <Icons.Box size={48} className="mb-4 opacity-20"/>
      <p>Dreaming up UI...</p>
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto pb-32 px-2">
      {blueprint.blocks.map((block, index) => {
        const Component = COMPONENTS[block.t] || COMPONENTS.Text;
        return (
          <div key={index} className="animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}>
            <Component 
              {...block} 
              // We pass the raw onClick string (e.g., "add_item") to the handler
              onClick={block.onClick ? () => !disabled && onAction(block.onClick, block.value || "click") : undefined} 
            />
          </div>
        );
      })}
    </div>
  );
};

export default A2UIRenderer;
