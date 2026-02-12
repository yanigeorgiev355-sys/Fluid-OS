import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// --- COMPONENT REGISTRY (The Lego Blocks) ---
const ComponentRegistry = {
  Card: ({ children, title, style }) => (
    <div className={`p-4 rounded-xl shadow-sm border mb-4 ${style === 'alert' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
      {title && <h3 className="font-bold text-slate-700 mb-2">{title}</h3>}
      <div className="space-y-3">{children}</div>
    </div>
  ),
  Text: ({ content, style }) => (
    <p className={style === 'highlight' ? 'text-blue-600 font-medium' : 'text-slate-600'}>
      {content}
    </p>
  ),
  Gauge: ({ value, max, unit, color }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    return (
      <div className="flex items-center gap-4 my-2">
        <div className="relative w-16 h-16 flex items-center justify-center rounded-full border-4"
             style={{ borderColor: '#f1f5f9', borderTopColor: color || '#3b82f6' }}>
           <span className="text-xs font-bold text-slate-700">{Math.round(percentage)}%</span>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800">{value} <span className="text-sm font-normal text-slate-400">{unit}</span></div>
          <div className="text-xs text-slate-500">Target: {max} {unit}</div>
        </div>
      </div>
    );
  },
  ButtonRow: ({ actions, onAction }) => (
    <div className="flex gap-2 mt-2">
      {actions.map((btn, idx) => (
        <button
          key={idx}
          onClick={() => onAction(btn.action, btn.payload)}
          className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
        >
          {btn.label}
        </button>
      ))}
    </div>
  ),
  Chart: ({ data, dataKey }) => (
    <div className="h-32 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="day" hide />
          <YAxis hide />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke="#8884d8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
};

// --- THE RENDERER (The Recursive Logic) ---
const A2UIRenderer = ({ blueprint, onAction }) => {
  if (!blueprint) return null;

  const renderComponent = (node, index) => {
    const Component = ComponentRegistry[node.type];
    if (!Component) return <div key={index} className="text-red-400 text-xs">Unknown: {node.type}</div>;

    const children = node.children 
      ? node.children.map((child, i) => renderComponent(child, i)) 
      : null;

    return (
      <Component key={index} {...node.props} onAction={onAction}>
        {children}
      </Component>
    );
  };

  return <div className="animate-in fade-in zoom-in duration-300">{renderComponent(blueprint, 0)}</div>;
};

export default A2UIRenderer;
    
