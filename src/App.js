import React, { useState, useEffect, useRef } from 'react';
import { Settings, Activity, Smartphone, MessageSquare, Grid, Plus, Trash2, X, Send, AlertTriangle, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import A2UIRenderer from './A2UIRenderer';

const GEMINI_MODEL_VERSION = "gemini-2.5-flash"; 

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    thought: { type: SchemaType.STRING },
    message: { type: SchemaType.STRING }, 
    app: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        type: { type: SchemaType.STRING, enum: ["tracker", "list", "dashboard", "note"] },
        data: { type: SchemaType.STRING }, 
        view: {
          type: SchemaType.OBJECT,
          properties: {
            layout: { type: SchemaType.STRING, enum: ["hero_center", "list_vertical", "grid_2col"] },
            theme: { type: SchemaType.STRING, enum: ["ocean", "sunset", "monochrome", "danger"] },
            icon: { type: SchemaType.STRING },
            message: { type: SchemaType.STRING }
          },
          required: ["layout", "theme"] 
        },
        inputs: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              label: { type: SchemaType.STRING },
              placeholder: { type: SchemaType.STRING }
            }
          }
        },
        actions: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              label: { type: SchemaType.STRING },
              icon: { type: SchemaType.STRING },
              variant: { type: SchemaType.STRING, enum: ["primary", "secondary", "ghost", "danger", "gradient"] },
              tool: { type: SchemaType.STRING }, 
              payload: { type: SchemaType.STRING } 
            },
            required: ["label", "tool", "payload", "variant"] 
          }
        }
      },
      required: ["title", "type", "data", "view", "actions"] 
    }
  },
  required: ["thought", "message", "app"]
};

const SYSTEM_PROMPT = `
You are the Architect of a Polymorphic OS.
Map User Intent to the Universal App Schema.

CRITICAL JSON STRING RULES:
The "data" and "payload" fields MUST be valid stringified JSON. Use escaped double quotes.

AVAILABLE TOOLS (For the payload):
- "update_data": { "key": "string", "operation": "add" | "set", "value": any }
- "reset_data": { "key": "string", "value": any }

DECLARATIVE INPUTS (How to ask the user to type something):
If you need the user to type a value, do TWO things:
1. Define a text box in the "inputs" array with a unique "id".
2. In your action's payload "value", use the magic string "$INPUT:your_id".

EXAMPLE OF CUSTOM INPUT:
{
  "inputs": [{ "id": "custom_cups", "label": "Custom Amount", "placeholder": "e.g. 5" }],
  "actions": [{ "label": "Add", "variant": "primary", "tool": "update_data", "payload": "{\\"key\\": \\"cups\\", \\"operation\\": \\"add\\", \\"value\\": \\"$INPUT:custom_cups\\"}" }]
}
`;

const safeParse = (input) => {
  if (!input) return {};
  if (typeof input === 'object') return input; 
  try { return JSON.parse(input); } 
  catch (e) { try { return JSON.parse(input.replace(/'/g, '"')); } catch (e2) { return {}; } }
};

const transformToBlocks = (appSchema) => {
  const { data = {}, view = {}, inputs = [], actions = [] } = appSchema;
  const blocks = [];

  blocks.push({ t: "Header", label: appSchema.title || "App", icon: view.icon || "Sparkles", variant: "hero" });

  if (view.layout === "hero_center") {
    const keys = Object.keys(data);
    let mainKey = keys.find(k => k !== 'unit') || "count";
    if (!data[mainKey]) data[mainKey] = 0;

    blocks.push({ 
      t: "Stat", 
      label: mainKey, 
      value: `${data[mainKey]} ${data.unit || ''}`.trim()
    });
  }

  if (view.message) blocks.push({ t: "Text", label: view.message, variant: "caption" });

  if (inputs && Array.isArray(inputs)) {
    inputs.forEach(input => {
      blocks.push({ t: "Input", id: input.id, label: input.label, placeholder: input.placeholder });
    });
  }

  if (actions && Array.isArray(actions) && actions.length > 0) {
    actions.forEach(action => {
      blocks.push({
        t: "Btn",
        label: action.label || "Action",
        variant: action.variant || "outline",
        icon: action.icon,
        onClick: JSON.stringify({ tool: action.tool, payload: action.payload })
      });
    });
  } else {
    blocks.push({ t: "Text", label: "No actions generated. Try asking again.", variant: "caption" });
  }

  return { blocks };
};

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [apps, setApps] = useState(() => JSON.parse(localStorage.getItem('neural_apps') || '[]'));
  const [messages, setMessages] = useState([{ role: 'model', text: "Ready. What shall we build?" }]);
  const [input, setInput] = useState('');
  const [formState, setFormState] = useState({});
  const [activeAppId, setActiveAppId] = useState(null); 
  const [view, setView] = useState('chat'); 
  const [loading, setLoading] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState(0); 
  const [settingsOpen, setSettingsOpen] = useState(!apiKey);
  const messagesEndRef = useRef(null);
  
  // NEW: State for expanding the text area
  const [isInputExpanded, setIsInputExpanded] = useState(false);

  useEffect(() => { localStorage.setItem('neural_apps', JSON.stringify(apps)); }, [apps]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (rateLimitTimer > 0) { const t = setInterval(() => setRateLimitTimer(c => c - 1), 1000); return () => clearInterval(t); } }, [rateLimitTimer]);

  const activeApp = apps.find(a => a.id === activeAppId);

  const handleInputChange = (id, value) => {
    setFormState(prev => ({ ...prev, [id]: value }));
  };

  const executeTool = (toolName, payload, currentData) => {
    let newData = { ...currentData };
    if (!payload) return newData;

    let finalValue = payload.value;

    if (typeof finalValue === 'string' && finalValue.startsWith("$INPUT:")) {
        const inputId = finalValue.replace("$INPUT:", "");
        const typedValue = formState[inputId];
        if (typedValue === undefined || typedValue.trim() === "") return currentData; 
        finalValue = isNaN(Number(typedValue)) ? typedValue : Number(typedValue);
    }

    if (toolName === "update_data") {
      const { key, operation } = payload;
      if (operation === "add") newData[key] = (Number(newData[key]) || 0) + Number(finalValue);
      else if (operation === "set") newData[key] = finalValue;
    }
    if (toolName === "reset_data") {
        newData[payload.key] = finalValue !== undefined ? finalValue : payload.value;
    }
    return newData;
  };

  const handleAppAction = async (actionJsonString) => {
    if (!activeApp) return;
    let action = safeParse(actionJsonString);
    if (!action.tool) return;

    const newData = executeTool(action.tool, action.payload, activeApp.universalSchema.data);
    const updatedApp = {
      ...activeApp,
      universalSchema: { ...activeApp.universalSchema, data: newData },
      blueprint: transformToBlocks({ ...activeApp.universalSchema, data: newData })
    };

    setApps(prev => prev.map(a => a.id === activeAppId ? updatedApp : a));
    setFormState({});
  };

  const handleSend = async () => {
    if (!input.trim() || !apiKey || rateLimitTimer > 0) return;
    
    const userText = input;
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setIsInputExpanded(false); // Auto-shrink input after sending
    setLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: GEMINI_MODEL_VERSION,
        generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA } 
      });

      let dynamicPrompt = SYSTEM_PROMPT;
      if (activeApp) {
        dynamicPrompt += `\n[CURRENT APP CONTEXT]:\nTitle: ${activeApp.title}\nData: ${JSON.stringify(activeApp.universalSchema.data)}`;
      }

      const chat = model.startChat({ history: [{ role: "user", parts: [{ text: dynamicPrompt }] }] });
      const result = await chat.sendMessage(userText);
      const responseData = JSON.parse(result.response.text());

      if (responseData.app) {
        const parsedApp = {
             ...responseData.app,
             data: safeParse(responseData.app.data),
             actions: (responseData.app.actions || []).map(a => ({ ...a, payload: safeParse(a.payload) }))
        };

        const uiBlueprint = transformToBlocks(parsedApp);

        const newApp = { 
          id: activeAppId || Date.now(), 
          title: parsedApp.title || "New App", 
          universalSchema: parsedApp, 
          blueprint: uiBlueprint      
        };

        if (activeAppId) {
             setApps(prev => prev.map(a => a.id === activeAppId ? newApp : a));
        } else {
             setApps(prev => [...prev, newApp]);
             setActiveAppId(newApp.id);
        }
        setView('app');
        setMessages(prev => [...prev, { role: 'model', text: responseData.message || "App updated." }]);
      }
    } catch (e) {
      if (e.message.includes('429')) setRateLimitTimer(30);
      setMessages(prev => [...prev, { role: 'system', text: "Error: " + e.message }]);
    }
    setLoading(false);
  };

  const saveKey = (e) => { e.preventDefault(); const key = e.target.elements.key.value; localStorage.setItem('gemini_key', key); setApiKey(key); setSettingsOpen(false); };
  const deleteApp = (id, e) => { e.stopPropagation(); setApps(prev => prev.filter(a => a.id !== id)); if (activeAppId === id) setActiveAppId(null); };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
      
      {/* VIEW 1: CHAT */}
      <div className={`absolute inset-0 flex flex-col bg-white transition-transform duration-300 ${view === 'chat' ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b flex justify-between bg-white z-10 shadow-sm">
          <span className="font-bold text-slate-800 flex items-center gap-2"><Activity size={20} className="text-blue-600"/> Neural Architect</span>
          <button onClick={() => setSettingsOpen(true)}><Settings size={20} className="text-slate-400"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`p-3 rounded-xl max-w-[85%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white self-end ml-auto' : m.role === 'system' ? 'text-xs text-red-400 text-center' : 'bg-slate-100 text-slate-800'}`}>{m.text}</div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {rateLimitTimer > 0 && <div className="bg-orange-50 text-orange-600 text-xs p-2 text-center flex items-center justify-center gap-2 animate-pulse"><AlertTriangle size={14}/> Cooling down: {rateLimitTimer}s</div>}

        {/* REBUILT CHAT INPUT BAR */}
        <div className="p-3 border-t bg-white flex items-end gap-2">
          
          {/* TOGGLE VIEW BUTTON MOVED HERE */}
          <button 
            onClick={() => setView('app')} 
            className="p-3 mb-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors flex-shrink-0"
            title="Go to App Dashboard"
          >
            <Smartphone size={24} />
          </button>

          {/* MULTILINE TEXTAREA */}
          <div className="flex-1 bg-slate-100 rounded-2xl relative border border-transparent focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all overflow-hidden">
            <textarea 
              className="w-full bg-transparent px-4 py-3 focus:outline-none resize-none text-slate-700 placeholder-slate-400" 
              placeholder="Describe an app..." 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              disabled={rateLimitTimer > 0}
              rows={isInputExpanded ? 6 : 1}
              style={{ minHeight: isInputExpanded ? '140px' : '48px', paddingRight: '40px' }}
            />
            
            {/* EXPAND BUTTON */}
            <button 
              onClick={() => setIsInputExpanded(!isInputExpanded)}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors bg-white/50 rounded p-1"
            >
              {isInputExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>

          <button 
            onClick={() => handleSend()} 
            disabled={rateLimitTimer > 0 || !input.trim()} 
            className="bg-blue-600 text-white p-3 mb-1 rounded-full shadow-lg disabled:bg-slate-300 disabled:shadow-none transition-all flex-shrink-0 active:scale-95"
          >
            <Send size={20}/>
          </button>
        </div>
      </div>

      {/* VIEW 2: APP STAGE */}
      <div className={`absolute inset-0 flex flex-col bg-slate-100 transition-transform duration-300 ${view === 'app' ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b bg-white z-10 shadow-sm flex justify-between items-center">
          <span className="font-bold text-slate-800 flex items-center gap-2"><Smartphone size={20} className="text-green-600"/> {activeApp ? activeApp.title : "No App"}</span>
          <button onClick={() => setView('dock')} className="p-2 hover:bg-slate-100 rounded-full text-blue-600"><Grid size={24} /></button>
        </div>
        
        {/* FIXED SCROLLING BUG HERE (removed justify-center, changed to block) */}
        <div className="flex-1 p-6 overflow-y-auto block relative pb-24">
          {loading && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-xs font-medium z-50 flex items-center gap-2 shadow-xl"><Loader2 size={14} className="animate-spin"/> Thinking...</div>}
          
          {activeApp && <div className="w-full max-w-md mx-auto"><A2UIRenderer blueprint={activeApp.blueprint} onAction={handleAppAction} onInputChange={handleInputChange} formState={formState} disabled={rateLimitTimer > 0} /></div>}
        </div>

        {/* RETURN TO CHAT BUTTON (Bottom Left of App View) */}
        <div className="absolute bottom-6 left-6 z-30">
          <button 
            onClick={() => setView('chat')} 
            className="bg-slate-900 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform active:scale-95 flex items-center gap-2"
          >
            <MessageSquare size={20} />
          </button>
        </div>
      </div>

      {/* VIEW 3: DOCK */}
      <div className={`absolute inset-0 bg-slate-800/90 backdrop-blur-md z-40 transition-opacity duration-300 ${view === 'dock' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center text-white mb-8"><h2 className="text-2xl font-bold">Apps</h2><button onClick={() => setView(activeApp ? 'app' : 'chat')}><X size={28}/></button></div>
          <div className="grid grid-cols-2 gap-4 overflow-y-auto pb-20">
            <button onClick={() => { setActiveAppId(null); setView('chat'); }} className="bg-white/10 hover:bg-white/20 border-2 border-dashed border-white/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-white transition"><div className="bg-blue-600 p-3 rounded-full"><Plus size={24}/></div><span className="font-medium">New App</span></button>
            {apps.map(app => (
              <div key={app.id} onClick={() => { setActiveAppId(app.id); setView('app'); }} className="bg-white p-6 rounded-2xl shadow-lg relative cursor-pointer hover:scale-105 transition-transform group">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl mb-3 shadow-md"></div>
                <h3 className="font-bold text-slate-800 truncate">{app.title}</h3>
                <button onClick={(e) => deleteApp(app.id, e)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {settingsOpen && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"><form onSubmit={saveKey} className="bg-white p-6 rounded-2xl w-80"><h2 className="text-lg font-bold mb-4">API Key</h2><input name="key" type="password" placeholder="AIza..." className="w-full border p-2 rounded mb-4" /><button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">Start</button></form></div>}
    </div>
  );
}
