import React from 'react';
import * as Icons from 'lucide-react';

// --- THE PREMIUM STAMPS (Hard-coded "Stitch" Styles) ---
// This guarantees the app ALWAYS looks professional, and saves tokens.
const Stamps = {
  // The Container (Clean, white, soft shadow)
  Card: ({ children, className }) => (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 ${className || ''}`}>
      {children}
    </div>
  ),
  
  // The Primary Action Button (Blue, bold, rounded)
  Btn: ({ children, onClick, className }) => (
    <button 
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-sm ${className || ''}`}
    >
      {children}
    </button>
  ),

  // The Secondary Button (Subtle, gray)
  BtnSec: ({ children, onClick, className }) => (
    <button 
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 active:scale-95 transition-all ${className || ''}`}
    >
      {children}
    </button>
  ),

  // The Header (Big, dark text)
  H1: ({ children, className }) => (
    <h1 className={`text-2xl font-bold text-slate-900 tracking-tight mb-4 ${className || ''}`}>
      {children}
    </h1>
  ),

  // The Label (Small, uppercase, gray)
  Lbl: ({ children, className }) => (
    <span className={`text-xs font-bold text-slate-400 uppercase tracking-wider ${className || ''}`}>
      {children}
    </span>
  ),

  // Icon Helper (Renders any Lucide icon by name)
  Icon: ({ name, className }) => {
    const IconComponent = Icons[name] || Icons.Activity;
    return <IconComponent className={className} size={20} />;
  }
};

const A2UIRenderer = ({ blueprint, onAction }) => {
  if (!blueprint || !blueprint.root) {
    return <div className="p-4 text-slate-400 italic text-center">Empty App Blueprint</div>;
  }

  const renderElement = (node, index) => {
    if (!node) return null;

    // DECODER: t=tag, p=props, c=children
    const tag = node.t || 'div';
    
    // Check if it's a "Stamp" (Premium Component)
    const StampComponent = Stamps[tag];
    const IsStamp = !!StampComponent;

    // Resolve Props
    const props = {
      key: index,
      // If it's a Stamp, we pass custom className on top of default. 
      // If it's HTML, we use it as the class.
      className: node.p?.s || "", 
      src: node.p?.src,
      alt: "App content",
      placeholder: node.p?.h, 
      defaultValue: node.p?.v,
      // Action Handler
      onClick: node.p?.k ? () => onAction(node.p.k, "click") : undefined,
      onKeyDown: (e) => {
        if (e.key === 'Enter' && node.p?.k) onAction(node.p.k, e.target.value);
      },
      // Icon Support
      name: node.p?.n // 'n' for Name (used in Icon stamp)
    };

    // Resolve Children
    let children = null;
    if (node.p?.x) children = node.p.x; // Text content
    else if (node.c && node.c.length > 0) children = node.c.map((child, i) => renderElement(child, i));

    // Render either the Stamp or the raw HTML tag
    if (IsStamp) {
      return React.createElement(StampComponent, props, children);
    } else {
      return React.createElement(tag, props, children);
    }
  };

  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-500">
      {renderElement(blueprint.root, 0)}
    </div>
  );
};

export default A2UIRenderer;
