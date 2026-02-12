import React from 'react';
import * as Icons from 'lucide-react';

const CARD_BASE = "bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300";

const COMPONENTS = {
  Header: ({ label, icon, value }) => {
    const Icon = icon && Icons[icon] ? Icons[icon] : Icons.Sparkles;
    return (
      <div className="mb-8 text-center space-y-4">
        <div className="inline-flex items-center justify-center p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-sm mb-2">
          <Icon size={32} strokeWidth={1.5} />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{label}</h1>
        {value && <p className="text-slate-500 text-lg font-medium">{value}</p>}
      </div>
    );
  },

  Stat: ({ label, value, icon, variant }) => {
    const Icon = icon && Icons[icon] ? Icons[icon] : null;
    const isPrimary = variant === 'primary';
    
    return (
      <div className={`${CARD_BASE} flex items-center justify-between group cursor-default relative overflow-hidden`}>
        {isPrimary && <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full blur-2xl group-hover:bg-blue-100 transition-colors"></div>}
        <div className="relative z-10">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-3xl font-black text-slate-800 tracking-tight">{value}</p>
        </div>
        {Icon && (
          <div className={`p-3 rounded-2xl relative z-10 ${isPrimary ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-50 text-slate-500'}`}>
            <Icon size={24} />
          </div>
        )}
      </div>
    );
  },

  Btn: ({ label, onClick, variant, icon }) => {
    const Icon = icon && Icons[icon] ? Icons[icon] : (variant === 'add' ? Icons.Plus : Icons.ArrowRight);
    
    const baseClass = "w-full py-4 px-6 rounded-full font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-900/5";
    const variants = {
      primary: "bg-slate-900 text-white hover:bg-slate-800 hover:shadow-xl",
      secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
      danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
      ghost: "bg-transparent text-slate-400 hover:text-slate-600 shadow-none"
    };

    return (
      <button onClick={onClick} className={`${baseClass} ${variants[variant] || variants.secondary} mb-4`}>
        <span>{label}</span>
        {variant !== 'ghost' && <Icon size={20} />}
      </button>
    );
  },

  Text: ({ label, value }) => (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-600 text-sm leading-relaxed mb-4">
      {value && <strong className="block text-slate-900 mb-1">{value}</strong>}
      {label}
    </div>
  ),

  Divider: () => <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-8 w-full" />
};

const A2UIRenderer = ({ blueprint, onAction }) => {
  // Loading State
  if (!blueprint) return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-pulse">
      <Icons.LayoutTemplate size={48} className="mb-4 opacity-20"/>
      <p>Building Interface...</p>
    </div>
  );

  // --- MODE A: HIGH FIDELITY (Raw HTML) ---
  if (blueprint.mode === 'html' || blueprint.html) {
      return (
          <div className="w-full h-full min-h-[500px] p-4">
            {/* We use a simple div wrapper with dangerouslySetInnerHTML.
                In a real production app with user content, you'd want to sanitize this.
                Since this is AI-generated local content, it's relatively safe for a demo.
            */}
            <div 
                className="prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: blueprint.html }} 
                onClick={(e) => {
                    // Capture clicks on elements with data-action attributes if you want interactive HTML later
                    // For now, this is mostly visual
                }}
            />
          </div>
      );
  }

  // --- MODE B: BLOCKS (Low Token) ---
  if (blueprint.blocks) {
    return (
        <div className="w-full max-w-md mx-auto pb-32 pt-6 px-4 space-y-4">
        {blueprint.blocks.map((block, index) => {
            const Component = COMPONENTS[block.t] || COMPONENTS.Text;
            return (
            <div key={index} className="animate-in slide-in-from-bottom-4 fade-in duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                <Component 
                {...block} 
                onClick={block.onClick ? () => onAction(block.onClick, "click") : undefined} 
                />
            </div>
            );
        })}
        </div>
    );
  }

  return null;
};

export default A2UIRenderer;
