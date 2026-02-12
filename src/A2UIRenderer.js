import React from 'react';

const ComponentRegistry = {
  // A "Stitch-like" Clean Card
  Card: ({ children, title }) => (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 animate-in zoom-in-95 duration-300">
      {title && <h3 className="text-xl font-bold text-slate-800 mb-6 tracking-tight">{title}</h3>}
      <div className="space-y-6">{children}</div>
    </div>
  ),
  
  Text: ({ content, style }) => (
    <p className={`text-base leading-relaxed ${style === 'highlight' ? 'text-blue-600 font-medium' : 'text-slate-600'}`}>
      {content}
    </p>
  ),

  // A "Stitch-like" Progress Bar
  Gauge: ({ value, max, unit }) => {
    const val = Number(value) || 0;
    const maximum = Number(max) || 100;
    const percentage = Math.min(100, Math.max(0, (val / maximum) * 100));
    return (
      <div>
        <div className="flex justify-between items-end mb-2">
          <span className="text-3xl font-bold text-slate-900">{val}<span className="text-sm text-slate-400 font-normal ml-1">{unit}</span></span>
          <span className="text-sm font-semibold text-blue-600">{Math.round(percentage)}%</span>
        </div>
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 transition-all duration-500 ease-out" style={{ width: `${percentage}%` }} />
        </div>
      </div>
    );
  },

  ButtonRow: ({ actions, onAction }) => (
    <div className="grid grid-cols-2 gap-3 pt-2">
      {(actions || []).map((btn, idx) => (
        <button
          key={idx}
          onClick={() => onAction(btn.action, btn.payload)}
          className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all active:scale-95 shadow-sm
            ${btn.label === 'Reset' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
};

const A2UIRenderer = ({ blueprint, onAction }) => {
  if (!blueprint) return null;
  const renderComponent = (node, index) => {
    if (!node) return null;
    const Component = ComponentRegistry[node.type];
    if (!Component) return <div key={index} className="text-red-400 text-xs">Unknown: {node.type}</div>;
    const children = node.children ? node.children.map((child, i) => renderComponent(child, i)) : null;
    return <Component key={index} {...node.props} onAction={onAction}>{children}</Component>;
  };
  return renderComponent(blueprint, 0);
};

export default A2UIRenderer;
