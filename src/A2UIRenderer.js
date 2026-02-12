import React from 'react';
import { Activity } from 'lucide-react';

const ComponentRegistry = {
  // 1. The Container Card
  Card: ({ children, title }) => (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 animate-in zoom-in-95 duration-300 w-full">
      {/* If title exists, show it. If not, ignore. */}
      {title && <h3 className="text-xl font-bold text-slate-800 mb-6 tracking-tight">{title}</h3>}
      <div className="space-y-6 w-full">
        {children && children.length > 0 ? children : <div className="text-slate-400 italic text-sm">Empty Card (AI sent no content)</div>}
      </div>
    </div>
  ),
  
  // 2. Simple Text
  Text: ({ content, style }) => (
    <p className={`text-base leading-relaxed ${style === 'highlight' ? 'text-blue-600 font-medium' : 'text-slate-600'}`}>
      {content || "..."}
    </p>
  ),

  // 3. The Gauge (Progress Bar)
  Gauge: ({ value, max, unit }) => {
    // Safety: Force numbers to prevent crashes
    const val = Number(value) || 0;
    const maximum = Number(max) || 100;
    const percentage = Math.min(100, Math.max(0, (val / maximum) * 100));
    
    return (
      <div className="w-full">
        <div className="flex justify-between items-end mb-2">
          <span className="text-3xl font-bold text-slate-900">
            {val}<span className="text-sm text-slate-400 font-normal ml-1">{unit || ""}</span>
          </span>
          <span className="text-sm font-semibold text-blue-600">{Math.round(percentage)}%</span>
        </div>
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all duration-500 ease-out" style={{ width: `${percentage}%` }} />
        </div>
      </div>
    );
  },

  // 4. Input Field (New! For user data entry)
  Input: ({ label, placeholder, onAction }) => (
    <div className="flex flex-col gap-2">
      {label && <label className="text-xs font-bold uppercase text-slate-400">{label}</label>}
      <input 
        type="text" 
        placeholder={placeholder || "Type here..."}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onKeyDown={(e) => {
          if (e.key === 'Enter') onAction('submit_input', e.target.value);
        }}
      />
    </div>
  ),

  // 5. Action Buttons
  ButtonRow: ({ actions, onAction }) => (
    <div className="grid grid-cols-2 gap-3 pt-2">
      {(actions || []).map((btn, idx) => (
        <button
          key={idx}
          onClick={() => onAction(btn.action || "unknown", btn.payload || "")}
          className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all active:scale-95 shadow-sm border border-transparent
            ${(btn.label || "").toLowerCase() === 'reset' 
              ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' 
              : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {btn.label || "Button"}
        </button>
      ))}
    </div>
  )
};

const A2UIRenderer = ({ blueprint, onAction }) => {
  // Safety Check: Did we get null data?
  if (!blueprint) return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Error: No App Data Received</div>;

  const renderComponent = (node, index) => {
    if (!node) return null;

    // Normalize: Handle AI naming confusion (Case insensitive)
    const type = node.type || "Text"; 
    const Component = ComponentRegistry[type] || ComponentRegistry[Object.keys(ComponentRegistry).find(k => k.toLowerCase() === type.toLowerCase())];

    // Fallback: If component is unknown, show debug info so we can fix it
    if (!Component) {
      return (
        <div key={index} className="p-3 mb-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 font-mono break-all">
          <strong>Unknown Component:</strong> {type} <br/>
          {JSON.stringify(node.props)}
        </div>
      );
    }

    const children = node.children 
      ? node.children.map((child, i) => renderComponent(child, i)) 
      : null;

    return (
      <Component key={index} {...(node.props || {})} onAction={onAction}>
        {children}
      </Component>
    );
  };

  return (
    <div className="w-full flex justify-center">
      {renderComponent(blueprint, 0)}
    </div>
  );
};

export default A2UIRenderer;
