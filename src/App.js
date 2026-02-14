import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, Activity, Smartphone, MessageSquare, Grid, Plus, 
  Trash2, X, Send, AlertTriangle, Loader2, Maximize2, Minimize2 
} from 'lucide-react';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import A2UIRenderer from './A2UIRenderer';
import { SYSTEM_PROMPT } from './ai/systemPrompt'; 

// CONFIGURATION
const GEMINI_MODEL_VERSION = "gemini-2.5-flash"; 

// --- 1. THE SCHEMA (Flexible & Tolerant) ---
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    tool_name: { type: SchemaType.STRING },
    archetype: { type: SchemaType.STRING, enum: ["Accumulator", "Regulator", "Checklist", "Drafter"] },
    
    // We allow nullable to prevent strict validation errors
    initial_state: { 
      type: SchemaType.OBJECT, 
      properties: {
        count: { type: SchemaType.NUMBER, nullable: true },
        is_running: { type: SchemaType.BOOLEAN, nullable: true },
        finished: { type: SchemaType.BOOLEAN, nullable: true },
        time_remaining: { type: SchemaType.NUMBER, nullable: true },
        items: { 
            type: SchemaType.ARRAY, 
            nullable: true,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    label: { type: SchemaType.STRING },
                    checked: { type: SchemaType.BOOLEAN }
                }
            } 
        }
      },
      nullable: true
    }, 

    blueprint: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: { type: SchemaType.STRING },
          label: { type: SchemaType.STRING },
          value_key: { type: SchemaType.STRING },
          action: { type: SchemaType.STRING },
          items_key: { type: SchemaType.STRING },
          state_key: { type: SchemaType.STRING },
          payload: { 
            type: SchemaType.OBJECT, 
            properties: {
                key: { type: SchemaType.STRING, nullable: true },
                amount: { type: SchemaType.NUMBER, nullable: true },
                value: { type: SchemaType.STRING, nullable: true },
                index: { type: SchemaType.NUMBER, nullable: true },
                initialValue: { type: SchemaType.NUMBER, nullable: true }
            },
            nullable: true 
          } 
        }
      }
    },
    message: { type: SchemaType.STRING }
  },
  required: ["tool_name", "archetype", "blueprint", "initial_state"]
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
  const [isInputExpanded, setIsInputExpanded] = useState(false);

  useEffect(() => { localStorage.setItem('neural_apps', JSON.stringify(apps)); }, [apps]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  
  useEffect(() => { 
    if (rateLimitTimer > 0) { 
      const t = setInterval(() => setRateLimitTimer(c => c - 1), 1000); 
      return () => clearInterval(t); 
    } 
  }, [rateLimitTimer]);

  // --- 2. THE TIMER HEARTBEAT ---
  useEffect(() => {
    const interval = setInterval(() => {
      setApps(prevApps => prevApps.map(app => {
        if (app.archetype === 'Regulator' && app.data.is_running) {
          const timeKey = Object.keys(app.data).find(k => typeof app.data[k] === 'number');
          
          if (timeKey) {
            if (app.data[timeKey] > 0) {
              return { 
                ...app, 
                data: { ...app.data, [timeKey]: app.data[timeKey] - 1 } 
              };
            } else {
              return { 
                ...app, 
                data: { ...app.data, is_running: false, finished: true } 
              };
            }
          }
        }
        return app;
      }));
    }, 1000); 

    return () => clearInterval(interval);
  }, []);

  const activeApp = apps.find(a => a.id === activeAppId);

  // --- 3. THE "SELF-HEALING" NERVOUS SYSTEM ---
  const handleAppAction = (actionType, payload) => {
    if (!activeApp) return;

    setApps(prevApps => prevApps.map(app => {
      if (app.id !== activeAppId) return app;

      let newData = { ...app.data };

      // HELPER: FIND THE BEST KEY
      // If the AI says "use key X" but X doesn't exist, find a better one.
      const findBestKey = (requestedKey, type) => {
        // 1. If the requested key exists, use it.
        if (newData[requestedKey] !== undefined) return requestedKey;
        
        // 2. If not, look for ANY key that matches the type we need.
        const fallback = Object.keys(newData).find(k => {
            if (type === 'array') return Array.isArray(newData[k]);
            if (type === 'number') return typeof newData[k] === 'number';
            if (type === 'boolean') return typeof newData[k] === 'boolean';
            return false;
        });

        // 3. If found, use the fallback. If not, return the requested key (and we will force-create it).
        return fallback || requestedKey;
      };

      // >>> ACCUMULATOR LOGIC
      if (actionType === 'INCREMENT_COUNT') {
        const key = findBestKey(payload.key || 'count', 'number');
        // Force create if still missing
        if (newData[key] === undefined) newData[key] = 0;
        newData[key] = Number(newData[key]) + (payload.amount || 1);
      }

      // >>> REGULATOR LOGIC
      if (actionType === 'START_TIMER') {
        newData.is_running = true;
        newData.finished = false;
      }
      if (actionType === 'STOP_TIMER') {
        newData.is_running = false;
      }
      if (actionType === 'RESET_TIMER') {
        newData.is_running = false;
        newData.finished = false;
        const key = findBestKey(payload.key || 'time_remaining', 'number');
        if (key) newData[key] = payload.initialValue || 0;
      }

      // >>> CHECKLIST LOGIC (The Fix for Beach List)
      if (actionType === 'ADD_CHECKLIST_ITEM') {
        // 1. Find the best array to add to. 
        // If 'items' doesn't exist, it might be 'packing_list'. If neither, it defaults to 'items'.
        const key = findBestKey(payload.key || 'items', 'array');
        
        // 2. Ensure it is actually an array (Self-Healing)
        if (!Array.isArray(newData[key])) {
             console.warn(`[Self-Healing] Created missing array for key: ${key}`);
             newData[key] = [];
        }

        // 3. Add the item
        newData[key] = [...newData[key], { 
            label: payload.value || "New Item", 
            checked: false,
            id: Date.now() 
        }];
      }

      if (actionType === 'TOGGLE_CHECKLIST_ITEM') {
        const key = findBestKey(payload.key || 'items', 'array');
        if (Array.isArray(newData[key]) && newData[key][payload.index]) {
          const updatedList = [...newData[key]];
          updatedList[payload.index].checked = !updatedList[payload.index].checked;
          newData[key] = updatedList;
        }
      }

      if (actionType === 'DELETE_CHECKLIST_ITEM') {
        const key = findBestKey(payload.key || 'items', 'array');
        if (Array.isArray(newData[key])) {
          const updatedList = [...newData[key]];
          updatedList.splice(payload.index, 1);
          newData[key] = updatedList;
        }
      }
      
      if (actionType === 'EDIT_CHECKLIST_ITEM') {
        const key = findBestKey(payload.key || 'items', 'array');
        if (Array.isArray(newData[key]) && newData[key][payload.index]) {
          const updatedList = [...newData[key]];
          updatedList[payload.index].label = payload.value;
          newData[key] = updatedList;
        }
      }

      return { ...app, data: newData };
    }));
  };

  const handleSend = async () => {
    if (!input.trim() || !apiKey || rateLimitTimer > 0) return;
    
    const userText = input;
    const newHistory = [...messages, { role: 'user', text: userText }];
    setMessages(newHistory);
    setInput('');
    setIsInputExpanded(false); 
    setLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: GEMINI_MODEL_VERSION,
        generationConfig: { 
          responseMimeType: "application/json", 
          responseSchema: RESPONSE_SCHEMA 
        } 
      });

      const chat = model.startChat({ 
        history: [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }] 
      });
      
      const result = await chat.sendMessage(userText);
      const responseText = result.response.text();
      const responseData = JSON.parse(responseText);

      if (responseData.tool_name && responseData.blueprint) {
        const newApp = { 
          id: activeAppId || Date.now(), 
          title: responseData.tool_name,
          archetype: responseData.archetype,
          blueprint: responseData.blueprint, 
          data: responseData.initial_state || {} 
        };

        if (activeAppId) setApps(prev => prev.map(a => a.id === activeAppId ? newApp : a));
        else { setApps(prev => [...prev, newApp]); setActiveAppId(newApp.id); }
        
        setView('app'); 
        setMessages(prev => [...prev, { role: 'model', text: responseData.message || `Created ${responseData.tool_name}.` }]);
      } else if (responseData.message) {
        setMessages(prev => [...prev, { role: 'model', text: responseData.message }]);
      }
    } catch (e) {
      if (e.message.includes('429')) setRateLimitTimer(30);
      setMessages(prev => [...prev, { role: 'system', text: "Error: " + e.message }]);
      console.error(e);
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
          <span className="font-bold text-slate-800 flex items-center gap-2"><Activity size={20} className="text-blue-600"/> Neural OS</span>
          <button onClick={() => setSettingsOpen(true)}><Settings size={20} className="text-slate-400"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`p-3 rounded-xl max-w-[85%] whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white self-end ml-auto' : m.role === 'system' ? 'text-xs text-red-400 text-center' : 'bg-slate-100 text-slate-800'}`}>{m.text}</div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {rateLimitTimer > 0 && <div className="bg-orange-50 text-orange-600 text-xs p-2 text-center flex items-center justify-center gap-2 animate-pulse"><AlertTriangle size={14}/> Cooling down: {rateLimitTimer}s</div>}

        <div className="p-3 border-t bg-white flex items-end gap-2">
          <button onClick={() => setView('app')} className="p-3 mb-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors flex-shrink-0"><Smartphone size={24} /></button>
          <div className="flex-1 bg-slate-100 rounded-2xl relative border border-transparent focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all overflow-hidden">
            <textarea 
              className="w-full bg-transparent px-4 py-3 focus:outline-none resize-none text-slate-700 placeholder-slate-400" 
              placeholder="Ask for a tool (e.g., 'Timer for laundry')..." 
              value={input} onChange={(e) => setInput(e.target.value)} disabled={rateLimitTimer > 0}
              rows={isInputExpanded ? 6 : 1}
              style={{ minHeight: isInputExpanded ? '140px' : '48px', paddingRight: '40px' }}
            />
            <button onClick={() => setIsInputExpanded(!isInputExpanded)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors bg-white/50 rounded p-1">
              {isInputExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
          <button onClick={() => handleSend()} disabled={rateLimitTimer > 0 || !input.trim()} className="bg-blue-600 text-white p-3 mb-1 rounded-full shadow-lg disabled:bg-slate-300 disabled:shadow-none transition-all flex-shrink-0 active:scale-95"><Send size={20}/></button>
        </div>
      </div>

      {/* VIEW 2: APP STAGE */}
      <div className={`absolute inset-0 flex flex-col bg-slate-100 transition-transform duration-300 ${view === 'app' ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b bg-white z-10 shadow-sm flex justify-between items-center">
          <span className="font-bold text-slate-800 flex items-center gap-2"><Smartphone size={20} className="text-green-600"/> {activeApp ? activeApp.title : "No App"}</span>
          <button onClick={() => setView('dock')} className="p-2 hover:bg-slate-100 rounded-full text-blue-600"><Grid size={24} /></button>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto block relative pb-24">
          {loading && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-xs font-medium z-50 flex items-center gap-2 shadow-xl"><Loader2 size={14} className="animate-spin"/> Thinking...</div>}
          
          {activeApp && (
            <div className="w-full mx-auto">
              <A2UIRenderer 
                blueprint={activeApp.blueprint} 
                data={activeApp.data} 
                onAction={handleAppAction} 
              />
            </div>
          )}
        </div>

        <div className="absolute bottom-6 left-6 z-30">
          <button onClick={() => setView('chat')} className="bg-slate-900 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform active:scale-95 flex items-center gap-2"><MessageSquare size={20} /></button>
        </div>
      </div>

      {/* VIEW 3: DOCK */}
      <div className={`absolute inset-0 bg-slate-800/90 backdrop-blur-md z-40 transition-opacity duration-300 ${view === 'dock' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center text-white mb-8"><h2 className="text-2xl font-bold">Tools</h2><button onClick={() => setView(activeApp ? 'app' : 'chat')}><X size={28}/></button></div>
          <div className="grid grid-cols-2 gap-4 overflow-y-auto pb-20">
            <button onClick={() => { setActiveAppId(null); setView('chat'); }} className="bg-white/10 hover:bg-white/20 border-2 border-dashed border-white/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-white transition"><div className="bg-blue-600 p-3 rounded-full"><Plus size={24}/></div><span className="font-medium">New Tool</span></button>
            {apps.map(app => (
              <div key={app.id} onClick={() => { setActiveAppId(app.id); setView('app'); }} className="bg-white p-6 rounded-2xl shadow-lg relative cursor-pointer hover:scale-105 transition-transform group">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl mb-3 shadow-md flex items-center justify-center text-white font-bold text-xl">{app.title[0]}</div>
                <h3 className="font-bold text-slate-800 truncate">{app.title}</h3>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{app.archetype}</p>
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
