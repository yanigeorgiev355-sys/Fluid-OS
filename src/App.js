import React, { useState, useEffect, useRef } from 'react';
import { Settings, Activity, Smartphone, MessageSquare, Grid, Plus, Trash2, X, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import A2UIRenderer from './A2UIRenderer';

const GEMINI_MODEL_VERSION = "gemini-2.5-flash"; 

// --- THE UNIVERSAL SCHEMA (FIXED) ---
// We use STRING for 'data' and 'payload' to avoid strict schema errors.
// The AI will write stringified JSON, and we will parse it.
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    thought: { type: SchemaType.STRING },
    app: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        type: { type: SchemaType.STRING, enum: ["tracker", "list", "dashboard", "note"] },
        
        // FIX: defined as STRING to allow flexible JSON structure
        data: { type: SchemaType.STRING }, 
        
        view: {
          type: SchemaType.OBJECT,
          properties: {
            layout: { type: SchemaType.STRING, enum: ["hero_center", "list_vertical", "grid_2col"] },
            theme: { type: SchemaType.STRING, enum: ["ocean", "sunset", "monochrome", "danger"] },
            icon: { type: SchemaType.STRING },
            message: { type: SchemaType.STRING }
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
              // FIX: defined as STRING to allow flexible arguments
              payload: { type: SchemaType.STRING } 
            }
          }
        }
      }
    }
  },
  required: ["thought", "app"]
};

const SYSTEM_PROMPT = `
You are the Architect of a Polymorphic OS.
Your goal is to map User Intent -> Universal App Schema.

CRITICAL INSTRUCTION:
- The fields "data" and "payload" must be returned as JSON STRINGS.
- Example: "data": "{\"count\": 0}"

UNIVERSAL SCHEMA RULES:
1. "data": The single source of truth (JSON String).
2. "view": Visual preferences.
3. "actions": Buttons that trigger TOOLS.

AVAILABLE TOOLS (Use these in "actions" payload):
- "update_data": { "key": "string", "operation": "add" | "set" | "append", "value": any }
- "reset_data": { "key": "string", "value": any }

LAYOUT STRATEGIES:
- "hero_center": Best for single counters (Water, Habits). Shows one big number.
- "list_vertical": Best for tasks, logs, history.
- "grid_2col": Best for dashboards.

EXAMPLE:
User: "Water tracker"
Output:
{
  "thought": "User wants a tracker. I will use 'hero_center'.",
  "app": {
    "title": "Hydration",
    "type": "tracker",
    "data": "{\"current\": 0, \"unit\": \"ml\"}",
    "view": { "layout": "hero_center", "theme": "ocean", "icon": "Droplets", "message": "Stay hydrated" },
    "actions": [
      { "label": "+250ml", "variant": "gradient", "tool": "update_data", "payload": "{\"key\": \"current\", \"operation\": \"add\", \"value\": 250}" }
    ]
  }
}
`;

// --- ADAPTER: Schema -> UI Blocks ---
const transformToBlocks = (appSchema) => {
  const { data, view, actions } = appSchema;
  const blocks = [];

  // 1. Header Block
  blocks.push({ t: "Header", label: appSchema.title, icon: view.icon, variant: "hero" });

  // 2. Data/View Mapping
  if (view.layout === "hero_center") {
    // For trackers, we show the main data point big
    const mainKey = Object.keys(data)[0]; 
    blocks.push({ 
      t: "Stat", 
      label: mainKey, 
      value: `${data[mainKey]} ${data.unit || ''}`, 
      variant: "hero" 
    });
  } else if (view.layout === "list_vertical") {
     // Placeholder for future list logic
     blocks.push({ t: "Text", label: "List view coming soon...", variant: "caption" });
  }

  if (view.message) {
    blocks.push({ t: "Text", label: view.message, variant: "caption" });
  }

  blocks.push({ t: "Divider" });

  // 3. Action Buttons
  if (actions) {
    actions.forEach(action => {
      // NOTE: payload is already an object here because we parsed it in handleSend
      blocks.push({
        t: "Btn",
        label: action.label,
        variant: action.variant,
        icon: action.icon,
        // We pack the tool & payload into the ID so we can execute it later
        onClick: JSON.stringify({ tool: action.tool, payload: action.payload })
      });
    });
  }

  return { blocks };
};

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [apps, setApps] = useState(() => JSON.parse(localStorage.getItem('neural_apps') || '[]'));
  const [messages, setMessages] = useState([{ role: 'model', text: "Ready. What shall we build?" }]);
  const [input, setInput] = useState('');
  
  const [activeAppId, setActiveAppId] = useState(null); 
  const [view, setView] = useState('chat'); 
  const [loading, setLoading] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState(0); 
  const [settingsOpen, setSettingsOpen] = useState(!apiKey);
  const messagesEndRef = useRef(null);

  useEffect(() => { localStorage.setItem('neural_apps', JSON.stringify(apps)); }, [apps]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (rateLimitTimer > 0) { const t = setInterval(() => setRateLimitTimer(c => c - 1), 1000); return () => clearInterval(t); } }, [rateLimitTimer]);

  const activeApp = apps.find(a => a.id === activeAppId);

  // --- THE LOGIC ENGINE ---
  // This replaces the "Placeholder". It runs locally!
  const executeTool = (toolName, payload, currentData) => {
    let newData = { ...currentData };
    
    // TOOL: Update Data (Add/Set)
    if (toolName === "update_data") {
      const { key, operation, value } = payload;
      
      if (operation === "add") {
        newData[key] = (Number(newData[key]) || 0) + Number(value);
      } else if (operation === "set") {
        newData[key] = value;
      }
    }
    
    // TOOL: Reset Data
    if (toolName === "reset_data") {
        const { key, value } = payload;
        newData[key] = value;
    }
    
    return newData;
  };

  const handleAppAction = async (actionJsonString) => {
    if (!activeApp) return;

    let action;
    try {
      action = JSON.parse(actionJsonString);
    } catch (e) {
      console.error("Invalid action JSON", actionJsonString);
      return;
    }

    // 1. RUN LOGIC LOCALLY
    const newData = executeTool(action.tool, action.payload, activeApp.universalSchema.data);

    // 2. UPDATE STATE (Optimistic UI)
    const updatedApp = {
      ...activeApp,
      universalSchema: { ...activeApp.universalSchema, data: newData },
      // Re-run adapter with new data
      blueprint: transformToBlocks({ ...activeApp.universalSchema, data: newData })
    };

    setApps(prev => prev.map(a => a.id === activeAppId ? updatedApp : a));
  };

  const handleSend = async () => {
    if (!input.trim() || !apiKey || rateLimitTimer > 0) return;
    
    const userText = input;
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: GEMINI_MODEL_VERSION,
        generationConfig: { 
          responseMimeType: "application/json", 
          responseSchema: RESPONSE_SCHEMA,
        } 
      });

      // Context aware prompt
      let dynamicPrompt = SYSTEM_PROMPT;
      if (activeApp) {
        // We re-serialize the data for the prompt so Gemini sees the latest state
        dynamicPrompt += `\n[CURRENT APP CONTEXT]:\nTitle: ${activeApp.title}\nData: ${JSON.stringify(activeApp.universalSchema.data)}`;
      }

      const chat = model.startChat({ history: [{ role: "user", parts: [{ text: dynamicPrompt }] }] });
      const result = await chat.sendMessage(userText);
      const rawText = result.response.text();
      const responseData = JSON.parse(rawText);

      if (responseData.app) {
        // --- PARSING FIX ---
        // We parse the stringified JSON fields back into Objects
        const parsedApp = {
             ...responseData.app,
             data: JSON.parse(responseData.app.data || '{}'),
             actions: responseData.app.actions.map(a => ({
                 ...a,
                 payload: JSON.parse(a.payload || '{}')
             }))
        };

        const uiBlueprint = transformToBlocks(parsedApp);

        const newApp = { 
          id: activeAppId || Date.now(), 
          title: parsedApp.title, 
          universalSchema: parsedApp, // Store the structured brain
          blueprint: uiBlueprint      // Store the visual body
        };

        if (activeAppId) {
             setApps(prev => prev.map(a => a.id === activeAppId ? newApp : a));
        } else {
             setApps(prev => [...prev, newApp]);
             setActiveAppId(newApp.id);
        }
        setView('app');
        setMessages(prev => [...prev, { role: 'model', text: responseData.thought || "App updated." }]);
      }
    } catch (e) {
      console.error(e);
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
            <div key={i} className={`p-3 rounded-xl max-w-[85%] ${m.role === 'user' ? 'bg-blue-600 text-white self-end ml-auto' : m.role === 'system' ? 'text-xs text-red-400 text-center' : 'bg-slate-100 text-slate-800'}`}>{m.text}</div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {rateLimitTimer > 0 && <div className="bg-orange-50 text-orange-600 text-xs p-2 text-center flex items-center justify-center gap-2 animate-pulse"><AlertTriangle size={14}/> Cooling down: {rateLimitTimer}s</div>}

        <div className="p-3 border-t bg-white flex gap-2">
          <input className="flex-1 bg-slate-100 rounded-full px-4 py-3 focus:outline-none" placeholder="Describe an app..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} disabled={rateLimitTimer > 0} />
          <button onClick={() => handleSend()} disabled={rateLimitTimer > 0} className="bg-blue-600 text-white p-3 rounded-full shadow-lg disabled:bg-slate-400"><Send size={20}/></button>
        </div>
      </div>

      {/* VIEW 2: APP STAGE */}
      <div className={`absolute inset-0 flex flex-col bg-slate-100 transition-transform duration-300 ${view === 'app' ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b bg-white z-10 shadow-sm flex justify-between items-center">
          <span className="font-bold text-slate-800 flex items-center gap-2"><Smartphone size={20} className="text-green-600"/> {activeApp ? activeApp.title : "No App"}</span>
          <button onClick={() => setView('dock')} className="p-2 hover:bg-slate-100 rounded-full text-blue-600"><Grid size={24} /></button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center relative">
          {loading && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-xs font-medium z-50 flex items-center gap-2 shadow-xl"><Loader2 size={14} className="animate-spin"/> Thinking...</div>}
          
          {/* RENDERER */}
          {activeApp && <div className="w-full max-w-md"><A2UIRenderer blueprint={activeApp.blueprint} onAction={handleAppAction} disabled={rateLimitTimer > 0} /></div>}
        </div>
      </div>

      {/* VIEW 3: DOCK */}
      <div className={`absolute inset-0 bg-slate-800/90 backdrop-blur-md z-40 transition-opacity duration-300 ${view === 'dock' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center text-white mb-8"><h2 className="text-2xl font-bold">Apps</h2><button onClick={() => setView(activeApp ? 'app' : 'chat')}><X size={28}/></button></div>
          <div className="grid grid-cols-2 gap-4 overflow-y-auto">
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

      {view !== 'dock' && (
        <button onClick={() => setView(view === 'chat' ? 'app' : 'chat')} className="fixed bottom-32 right-6 bg-slate-900 text-white p-4 rounded-full shadow-2xl z-30 hover:scale-110 transition-transform active:scale-95">
          {view === 'chat' ? <Smartphone size={24} /> : <MessageSquare size={24} />}
        </button>
      )}
      {settingsOpen && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"><form onSubmit={saveKey} className="bg-white p-6 rounded-2xl w-80"><h2 className="text-lg font-bold mb-4">API Key</h2><input name="key" type="password" placeholder="AIza..." className="w-full border p-2 rounded mb-4" /><button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">Start</button></form></div>}
    </div>
  );
}
