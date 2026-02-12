import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// --- THE NORMALIZER (The Self-Healing Layer) ---
// This function cleans up "messy" JSON from the AI before it breaks the app.
const normalizeBlueprint = (node) => {
  if (!node) return null;

  // 1. Fix Component Names (Synonyms)
  if (node.type === "ButtonList" || node.type === "Buttons") node.type = "ButtonRow";
  if (node.type === "Paragraph" || node.type === "Span" || node.type === "Label") node.type = "Text";

  // 2. Fix Properties (The "Synonym" problem)
  if (node.props) {
    // Move 'buttons' or 'btns' to 'actions'
    if (node.props.buttons) {
      node.props.actions = node.props.buttons;
      delete node.props.buttons;
    }
    if (node.props.btns) {
      node.props.actions = node.props.btns;
      delete node.props.btns;
    }

    // Unify 'content' and 'text'
    if (node.props.content && !node.props.text) node.props.text = node.props.content;
    if (node.props.text && !node.props.content) node.props.content = node.props.text;
  }

  // 3. Clean Children recursively
  if (node.children) {
    node.children = node.children.map(normalizeBlueprint);
  }

  return node;
};

// --- COMPONENT REGISTRY (The Lego Blocks) ---
const ComponentRegistry = {
  Card: ({ children, title, style }) => (
    <div className={`p-4 rounded-xl shadow-sm border mb-4 ${style === 'alert' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
      {title && <h3 className="font-bold text-slate-700 mb-2">{title}</h3>}
      <div className="space-y-3">{children}</div>
    </div>
  ),
  
  Text: ({ content, text, style }) => (
    <p className={style === 'highlight' ? 'text-blue-600 font-medium' : style === 'muted' ? 'text-slate-400 text-sm' : 'text-slate-600'}>
      {content || text || ""} 
    </p>
  ),

  Gauge: ({ value, max, unit, color }) => {
    const val = Number(value) || 0;
    const maximum = Number(max) || 100;
    const percentage = Math.min(100, Math.max(0, (val / maximum) * 100));
    
    return (
      <div className="flex items-center gap-4 my-2">
        <div className="relative w-16 h-16 flex items-center justify-center rounded-full border-4"
             style={{ borderColor: '#f1f5f9', borderTopColor: color || '#3b82f6' }}>
           <span className="text-xs font-bold text-slate-700">{Math.round(percentage)}%</span>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800">{val} <span className="text-sm font-normal text-slate-400">{unit}</span></div>
          <div className="text-xs text-slate-500">Target: {maximum} {unit}</div>
        </div>
      </div>
    );
  },

  ButtonRow: ({ actions, onAction }) => {
    const items = actions || []; 
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {items.map((btn, idx) => (
          <button
            key={idx}
            onClick={() => onAction(btn.action || btn.id || "unknown", btn.payload || btn.value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              btn.style === 'danger' 
                ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            {btn.label || btn.text || "Button"}
          </button>
        ))}
      </div>
    );
  },

  Chart: ({ data, dataKey }) => (
    <div className="h-32 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data || []}>
          <XAxis dataKey="day" hide />
          <YAxis hide />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey || 'value'} stroke="#8884d8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
};

// --- THE RENDERER ---
const A2UIRenderer = ({ blueprint, onAction }) => {
  if (!blueprint) return null;

  // STEP 1: Deep copy the blueprint so we can modify it
  const rawData = JSON.parse(JSON.stringify(blueprint));
  
  // STEP 2: Run the Self-Healing Normalizer
  const cleanData = normalizeBlueprint(rawData);

  const renderComponent = (node, index) => {
    if (!node) return null;
    
    const Component = ComponentRegistry[node.type];
    
    // Fallback for unknown types
    if (!Component) return (
      <div key={index} className="text-red-400 text-xs p-2 border border-red-200 rounded bg-red-50">
        Unknown Component: {node.type}
      </div>
    );

    const children = node.children 
      ? node.children.map((child, i) => renderComponent(child, i)) 
      : null;

    return (
      <Component key={index} {...node.props} onAction={onAction}>
        {children}
      </Component>
    );
  };

  return <div className="animate-in fade-in zoom-in duration-300">{renderComponent(cleanData, 0)}</div>;
};

export default A2UIRenderer;
