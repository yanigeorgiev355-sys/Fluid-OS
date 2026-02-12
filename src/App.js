import React, { useState, useEffect, useRef } from 'react';
import { Settings, Activity, Smartphone, MessageSquare, Grid, Plus, Trash2, X, Send } from 'lucide-react';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import A2UIRenderer from './A2UIRenderer';

const GEMINI_MODEL_VERSION = "gemini-2.5-flash"; 

// --- SHARED PROPS DEFINITION ---
// We define this once and use it at every level to prevent "Empty Object" errors.
const PROPS_DEFINITION = {
  label: { type: SchemaType.STRING, nullable: true },
  value: { type: SchemaType.STRING, nullable: true },
  sub: { type: SchemaType.STRING, nullable: true },
  max: { type: SchemaType.NUMBER, nullable: true },
  icon: { type: SchemaType.STRING, nullable: true },
  variant: { type: SchemaType.STRING, enum: ["primary", "secondary", "danger", "ghost", "title", "sub"], nullable: true },
  onClick: { type: SchemaType.STRING, nullable: true },
  content: { type: SchemaType.STRING, nullable: true }
};

// --- THE FIXED SCHEMA ---
// We explicitly define 3 levels of nesting. This covers 99% of UIs (Container -> Card -> Stat).
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    thought: { type: SchemaType.STRING },
    response: { type: SchemaType.STRING },
    tool: {
      type: SchemaType.OBJECT,
      nullable: true,
      properties: {
        title: { type: SchemaType.STRING },
        root: {
          type: SchemaType.OBJECT,
          properties: {
            t: { type: SchemaType.STRING }, // Root Tag
            p: { type: SchemaType.OBJECT, nullable: true, properties: PROPS_DEFINITION }, // Root Props
            c: {
              type: SchemaType.ARRAY,
              nullable: true,
              items: {
                type: SchemaType.OBJECT, // Level 1 Child
                properties: {
                  t: { type: SchemaType.STRING },
                  p: { type: SchemaType.OBJECT, nullable: true, properties: PROPS_DEFINITION },
                  c: {
                    type: SchemaType.ARRAY,
                    nullable: true,
                    items: {
                      type: SchemaType.OBJECT, // Level 2 Grandchild
                      properties: {
                         t: { type: SchemaType.STRING },
                         p: { type: SchemaType.OBJECT, nullable: true, properties: PROPS_DEFINITION }
                         // We stop recursion here to prevent "Infinite Loop" errors.
                         // 3 Levels is enough for "Card > Grid > Stat".
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  required: ["thought", "response"]
};

const SYSTEM_PROMPT = `
You are Neural OS.
- Be conversational.
- To build a tool, return a "tool" object using these SMART COMPONENTS:
  1. "Stat": { label: "Water", value: "500ml", icon: "Droplets" }
  2. "Progress": { label: "Goal", value: 50, max: 100 }
  3. "Btn": { label: "Add Water", variant: "primary", onClick: "add_250" }
  4. "Grid": Container for side-by-side stats/buttons.
  5. "Card": White box to group items.
  
- DO NOT write CSS. The system handles design.
- If the user adds data, CALCULATE the new state and return the updated tool.
`;

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [apps, setApps] = useState(() => JSON.parse(localStorage.getItem('neural_apps') || '[]'));
  const [messages, setMessages] = useState([{ role: 'model', text: "Ready. What shall we build?" }]);
  const [input, setInput] = useState('');
  
  const [activeAppId, setActiveAppId] = useState(null); 
  const [view, setView] = useState('chat'); 
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(!apiKey);
  const messagesEndRef = useRef(null);

  useEffect(() => { localStorage.setItem('neural_apps', JSON.stringify(apps)); }, [apps]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const activeApp = apps.find(a => a.id === activeAppId);

  const handleSend = async () => {
    if (!input.trim() || !apiKey) return;
    
    const newMsgs = [...messages, { role: 'user', text: input }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: GEMINI_MODEL_VERSION,
        generationConfig: { 
          responseMimeType: "application/json", 
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 2000
        } 
      });

      let dynamicPrompt = SYSTEM_PROMPT;
      if (activeApp) {
        dynamicPrompt += `\n[CURRENT APP STATE]:
        Title: "${activeApp.title}"
        Data: ${JSON.stringify(activeApp.blueprint)}
        INSTRUCTION: Return the FULL updated component tree with new values.`;
      }

      const chat = model.startChat({ history: [{ role: "user", parts: [{ text: dynamicPrompt }] }] });
      const result = await chat.sendMessage(input);
      
      let data;
      try {
        data = JSON.parse(result.response.text());
      } catch (jsonError) {
        console.error("JSON Crash:", jsonError);
        data = { response: "I had trouble building that. Please try again.", tool: null };
      }
      
      setMessages(prev => [...prev, { role: 'model', text: data.response }]);
      
      if (data.tool) {
        const newToolTitle = data.tool.title || "New App";
        if (activeApp) {
             setApps(prev => prev.map(app => 
               app.id === activeAppId ? { ...app, blueprint: data.tool, title: newToolTitle } : app
             ));
        } else {
             const newApp = { id: Date.now(), title: newToolTitle, blueprint: data.tool };
             setApps(prev => [...prev, newApp]);
             setActiveAppId(newApp.id);
        }
        setView('app'); 
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'system', text: "System Error: " + e.message }]);
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
          <span className="font-bold text-slate-800 flex items-center gap-2"><Activity size={20} className="text-blue-600"/> Neural Chat</span>
          <button onClick={() => setSettingsOpen(true)}><Settings size={20} className="text-slate-400"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`p-3 rounded-xl max-w-[85%] ${m.role === 'user' ? 'bg-blue-600 text-white self-end ml-auto' : 'bg-slate-100 text-slate-800'}`}>{m.text}</div>
          ))}
          {loading && <div className="text-slate-400 text-sm ml-4 animate-pulse">Thinking...</div>}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-3 border-t bg-white flex gap-2">
          <input className="flex-1 bg-slate-100 rounded-full px-4 py-3 focus:outline-none" placeholder="Type a message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
          <button onClick={handleSend} className="bg-blue-600 text-white p-3 rounded-full shadow-lg"><Send size={20}/></button>
        </div>
      </div>

      {/* VIEW 2: APP STAGE */}
      <div className={`absolute inset-0 flex flex-col bg-slate-100 transition-transform duration-300 ${view === 'app' ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b bg-white z-10 shadow-sm flex justify-between items-center">
          <span className="font-bold text-slate-800 flex items-center gap-2"><Smartphone size={20} className="text-green-600"/> {activeApp ? activeApp.title : "No App"}</span>
          <button onClick={() => setView('dock')} className="p-2 hover:bg-slate-100 rounded-full text-blue-600"><Grid size={24} /></button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center">
          {activeApp && <div className="w-full max-w-md"><A2UIRenderer blueprint={activeApp.blueprint} onAction={(a, p) => alert(`Action: ${a}, Value: ${p}`)} /></div>}
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

      {/* TOGGLE BUTTON */}
      {view !== 'dock' && (
        <button onClick={() => setView(view === 'chat' ? 'app' : 'chat')} className="fixed bottom-32 right-6 bg-slate-900 text-white p-4 rounded-full shadow-2xl z-30 hover:scale-110 transition-transform active:scale-95">
          {view === 'chat' ? <Smartphone size={24} /> : <MessageSquare size={24} />}
        </button>
      )}
      {settingsOpen && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"><form onSubmit={saveKey} className="bg-white p-6 rounded-2xl w-80"><h2 className="text-lg font-bold mb-4">API Key</h2><input name="key" type="password" placeholder="AIza..." className="w-full border p-2 rounded mb-4" /><button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">Start</button></form></div>}
    </div>
  );
}
