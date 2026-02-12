import React from 'react';
import * as Icons from 'lucide-react';

// --- THE SMART STITCH LIBRARY ---
// We hard-code the beautiful designs here so the AI doesn't have to write them.
const COMPONENTS = {
  // 1. The Main Container (Page Layout)
  Container: ({ children }) => (
    <div className="w-full space-y-4 p-1 animate-in fade-in duration-500">
      {children}
    </div>
  ),

  // 2. A Section Card (White background, shadow)
  Card: ({ children, title }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {title && <h3 className="text-lg font-bold text-slate-800 mb-4">{title}</h3>}
      <div className="space-y-4">{children}</div>
    </div>
  ),

  // 3. A Stat Display (Big Number + Label)
  // Usage: { t: "Stat", p: { label: "Water", value: "2L", icon: "Droplets" } }
  Stat: ({ label, value, sub, icon }) => {
    const Icon = icon && Icons[icon] ? Icons[icon] : null;
    return (
      <div className="flex items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
        {Icon && <div className="p-3 bg-white rounded-full shadow-sm mr-4 text-blue-600"><Icon size={24} /></div>}
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{label}</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
            {sub && <span className="text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded">{sub}</span>}
          </div>
        </div>
      </div>
    );
  },

  // 4. Progress Bar (The Stitch Style)
  Progress: ({ value, max, label }) => {
    const pct = Math.min(100, Math.max(0, ((Number(value) || 0) / (Number(max) || 100)) * 100));
    return (
      <div className="w-full">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <span className="text-sm font-bold text-blue-600">{Math.round(pct)}%</span>
        </div>
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  },

  // 5. Smart Button (Variants: primary, secondary, danger)
  Btn: ({ label, onClick, variant, icon }) => {
    const Icon = icon && Icons[icon] ? Icons[icon] : null;
    const styles = {
      primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200",
      secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
      danger: "bg-red-50 text-red-600 hover:bg-red-100",
      ghost: "text-slate-500 hover:bg-slate-100"
    };
    return (
      <button 
        onClick={onClick}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all active:scale-95 ${styles[variant || 'primary']}`}
      >
        {Icon && <Icon size={18} />}
        {label}
      </button>
    );
  },

  // 6. Grid Layout (2 Columns)
  Grid: ({ children }) => (
    <div className="grid grid-cols-2 gap-3">{children}</div>
  ),
  
  // 7. Text Display
  Text: ({ content, variant }) => {
    const s = variant === 'title' ? "text-xl font-bold text-slate-900" 
            : variant === 'sub' ? "text-sm text-slate-500" 
            : "text-base text-slate-700";
    return <p className={s}>{content}</p>;
  }
};

const A2UIRenderer = ({ blueprint, onAction }) => {
  if (!blueprint || !blueprint.root) return <div className="text-slate-400 text-center p-4">Empty App</div>;

  const renderElement = (node, index) => {
    if (!node) return null;
    
    // t = Tag Name (e.g., "Stat", "Btn")
    // p = Props (e.g., { label: "Hi" })
    // c = Children List
    const Component = COMPONENTS[node.t] || COMPONENTS.Text;

    // Map Props & Action Handlers
    const props = {
      key: index,
      ...node.p,
      onClick: node.p?.onClick ? () => onAction(node.p.onClick, "click") : undefined
    };

    // Render Children Recursively
    const children = node.c ? node.c.map((child, i) => renderElement(child, i)) : null;

    return <Component {...props}>{children}</Component>;
  };

  return <div className="w-full">{renderElement(blueprint.root, 0)}</div>;
};

export default A2UIRenderer;
