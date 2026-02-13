import React from 'react';
import * as Icons from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const COMPONENTS = {
  Header: ({ label, icon }) => {
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
    if (value === undefined) return null;
    const Icon = icon && Icons[icon] ? Icons[icon] : null;
    return (
      <div className="group relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-4 animate-in slide-in-from-bottom-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</span>
            <span className="text-5xl font-extrabold text-slate-900 tracking-tighter">{value}</span>
          </div>
          {Icon && <div className="text-slate-300"><Icon size={24} /></div>}
        </div>
      </div>
    );
  },

  // THE NEW PRO CHART COMPONENT
  Chart: ({ data }) => {
    if (!data || !Array.isArray(data) || data.length < 2) return null; // Need 2 points to draw a line
    
    // Auto-detect which key is the number we want to plot
    const plotKey = Object.keys(data[0]).find(k => typeof data[0][k] === 'number');
    if (!plotKey) return null;

    return (
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-4 h-56 animate-in fade-in zoom-in">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Activity Trend</h3>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="timestamp" hide />
            <Tooltip 
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} 
              itemStyle={{ color: '#3b82f6' }}
            />
            <Area type="monotone" dataKey={plotKey} stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  },

  // THE NEW PRO HISTORY LIST COMPONENT
  DataList: ({ data }) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return <div className="p-6 bg-white rounded-3xl border border-slate-100 mb-4 text-center text-slate-400 text-sm">No history yet. Start tracking!</div>;
    }
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-4 animate-in slide-in-from-bottom-3">
        {/* We slice and reverse so the newest entry is always at the top */}
        {data.slice().reverse().map((item, i) => {
           const numKey = Object.keys(item).find(k => typeof item[k] === 'number');
           const strKey = Object.keys(item).find(k => typeof item[k] === 'string' && k !== 'timestamp');
           
           return (
             <div key={i} className="p-4 border-b border-slate-50 last:border-0 flex justify-between items-center hover:bg-slate-50 transition-colors">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-700 capitalize">{item[strKey] || 'Entry'}</span>
                  <span className="text-xs text-slate-400 font-medium">{item.timestamp}</span>
                </div>
                <span className="font-extrabold text-blue-600">{item[numKey] !== undefined ? item[numKey] : ''}</span>
             </div>
           );
        })}
      </div>
    );
  },

  Input: ({ id, label, placeholder, value, onInputChange }) => (
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
  ),

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
