import React, { useState, useEffect, useRef } from 'react';
import { Settings, Activity, Smartphone, MessageSquare, Grid, Plus, Trash2, X, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import A2UIRenderer from './A2UIRenderer';

const GEMINI_MODEL_VERSION = "gemini-2.0-flash"; 

// 1. STRICT SCHEMA to force valid JSON
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
        blocks: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              t: { type: SchemaType.STRING, enum: ["Header", "Stat", "Btn", "Text", "Divider"] }, 
              label: { type: SchemaType.STRING, nullable: true },
              value: { type: SchemaType.STRING, nullable: true },
              icon: { type: SchemaType.STRING, nullable: true },
              variant: { type: SchemaType.STRING, nullable: true }, 
              onClick: { type: SchemaType.STRING, nullable: true }
            }
          }
        }
      }
    }
  },
  required: ["thought", "response"]
};

const SYSTEM_PROMPT = `
You are Fluid OS.
- If the user just says "hi" or asks a question, set "tool" to null.
- If the user asks for a tool (e.g. "calculator", "tracker"), return a "tool" object.

DESIGN SYSTEM (STITCH-LITE):
Use ONLY these blocks:
1. "Header": { "label": "Title", "value": "Subtitle", "icon": "Activity" }
2. "Stat": { "label": "Label", "value": "Value", "icon": "Zap", "variant": "primary" }
3. "Btn": { "label": "Button Text", "onClick": "action_id", "variant": "primary" }
4. "Text": { "label": "Body text", "value": "Bold Heading" }
5. "Divider": {} 

LOGIC:
- When a user clicks a button, calculate the new state and return the COMPLETE updated block list.
`;

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

  useEffect(() => {
    if (rateLimitTimer > 0) {
      const timer = setInterval(() => setRateLimitTimer(t => t - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [rateLimitTimer]);

  const activeApp = apps.find(a => a.id === activeAppId);

  const handleAppAction = async (actionId, payload) => {
    if (rateLimitTimer > 0) return; 
    const actionPrompt = `[USER CLICKED]: Button "${actionId}". Value: "${payload}".\nTASK: Update the interface blocks to reflect this change.`;
    handleSend(actionPrompt, true); 
  };

  // --- THE NUCLEAR PARSER ---
  const robustJSONParse = (text) => {
    try {
      // 1. Try standard parse
      return JSON.parse(text);
    } catch (e) {
      // 2. If that fails, extract the JSON object using Regex
      // This looks for the first '{' and the last '}'
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e2) {
          console.error("Regex Parse Failed");
          return null;
        }
      }
      return null;
    }
  };

  const handleSend = async (manualInput = null, isSystemAction = false) => {
    if (rateLimitTimer > 0) return; 
    
    const textToSend = manualInput || input;
    if (!textToSend.trim() || !apiKey) return;
    
    if (!isSystemAction) {
        setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
        setInput('');
    }
    
    setLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: GEMINI_MODEL_VERSION,
        generationConfig: { 
          responseMimeType: "application/json", 
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 4000 
        } 
      });

      let dynamicPrompt = SYSTEM_PROMPT;
      if (activeApp) {
        dynamicPrompt += `\n[CURRENT APP STATE ("${activeApp.title}")]:
        ${JSON.stringify(activeApp.blueprint.blocks)}
        \nINSTRUCTION: Apply action "${textToSend}" to this state. Return the NEW complete block list.`;
      }

      const chat = model.startChat({ 
        history: messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.text }]
        }))
      });

      const result = await chat.sendMessage(textToSend);
      const responseText = result.response.text();
      
      console.log("Raw AI Response:", responseText); // Debugging

      const data = robustJSONParse(responseText);

      if (!data) {
          setMessages(prev => [...prev, { role: 'model', text: "I tried to build that, but I made a syntax error. Please ask again." }]);
      } else {
          if (data.response && !isSystemAction) {
              setMessages(prev => [...prev, { role: 'model', text: data.response }]);
          }
          
          if (data.tool) {
            const newToolTitle = data.tool.title || activeApp?.title || "New App";
            if (activeApp) {
                setApps(prev => prev.map(app => 
                  app.id === activeAppId ? { ...app, blueprint: data.tool, title: newToolTitle } : app
                ));
            } else {
                const newApp = { id: Date.now(), title: newToolTitle, blueprint: data.tool };
                setApps(prev => [...prev, newApp]);
                setActiveAppId(newApp.id);
            }
            if (!isSystemAction) setView('app'); 
          }
      }
    } catch (e) {
      if (e.message.includes('429')) {
        setRateLimitTimer(60); 
      } else {
        setMessages(prev => [...prev, { role: 'model', text: "Error: " + e.message }]);
      }
    }
    setLoading(false);
  };

  const saveKey = (e) => { 
    e.preventDefault(); 
    const key = e.target.elements.key.value; 
    localStorage.setItem('gemini_key', key); 
    setApiKey(key); 
    setSettingsOpen(false); 
  };

  const deleteApp = (id, e) => { 
    e.stopPropagation(); 
    setApps(prev => prev.filter(a => a.id !== id)); 
    if (activeAppId === id) {
        setActiveAppId(null);
        setView('chat');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
      
      {/* VIEW 1: CHAT */}
      <div className={`absolute inset-0 flex flex-col bg-white transition-transform duration-300 ${view === 'chat' ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b flex justify-between bg-white z-10 shadow-sm">
          <span className="font-bold text-slate-900 flex items-center gap-2">
            <Activity size={20} className="text-blue-600"/> Fluid OS
          </span>
          <button onClick={() => setSettingsOpen(true)}>
            <Settings size={20} className="text-slate-400 hover:text-slate-600"/>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user' 
                ? 'bg-slate-900 text-white self-end ml-auto rounded-tr-none' 
                : 'bg-slate-100 text-slate-800 rounded-tl-none'
            }`}>
                {m.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {rateLimitTimer > 0 && (
            <div className="bg-orange-50 text-orange-600 text-xs p-2 text-center flex items-center justify-center gap-2 animate-pulse">
                <AlertTriangle size={14}/> API Cooling Down: {rateLimitTimer}s
            </div>
        )}

        {/* INPUT AREA: 3 Rows, Enter = New Line */}
        <div className="p-3 border-t bg-white flex gap-2 items-end pb-8">
          <textarea 
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 resize-none font-sans text-sm" 
            rows={3}
            placeholder={rateLimitTimer > 0 ? "Waiting..." : "Describe an app..."} 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            disabled={rateLimitTimer > 0} 
          />
          <button 
            onClick={() => handleSend()} 
            disabled={rateLimitTimer > 0 || loading} 
            className="bg-blue-600 text-white p-3 mb-4 rounded-full shadow-lg disabled:bg-slate-300 hover:bg-blue-700 transition-colors"
          >
            {loading ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
          </button>
        </div>
      </div>

      {/* VIEW 2: APP */}
      <div className={`absolute inset-0 flex flex-col bg-slate-50 transition-transform duration-300 ${view === 'app' ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 bg-white/80 backdrop-blur-md z-10 sticky top-0 flex justify-between items-center border-b border-slate-100">
          <span className="font-bold text-slate-800 flex items-center gap-2">
             {activeApp ? activeApp.title : "App View"}
          </span>
          <button onClick={() => setView('dock')} className="p-2 hover:bg-slate-100 rounded-full text-blue-600 transition-colors">
            <Grid size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto relative custom-scrollbar">
          {loading && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-5 py-2 rounded-full text-xs font-bold z-50 flex items-center gap-2 shadow-2xl backdrop-blur-sm">
                <Loader2 size={14} className="animate-spin text-blue-400"/> UPDATING...
            </div>
          )}

          <div className="pt-6">
            {activeApp && <A2UIRenderer blueprint={activeApp.blueprint} onAction={handleAppAction} />}
          </div>
        </div>
      </div>

      {/* VIEW 3: DOCK */}
      <div className={`absolute inset-0 bg-slate-900/95 backdrop-blur-xl z-40 transition-opacity duration-300 ${view === 'dock' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center text-white mb-8">
            <h2 className="text-3xl font-bold tracking-tight">Your Apps</h2>
            <button onClick={() => setView(activeApp ? 'app' : 'chat')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={28}/>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 overflow-y-auto pb-20">
            <button onClick={() => { setActiveAppId(null); setView('chat'); }} className="bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/20 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-white transition-all group">
                <div className="bg-blue-600 p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-lg shadow-blue-900/50">
                    <Plus size={24} className="text-white"/>
                </div>
                <span className="font-medium text-sm">Create New</span>
            </button>
            {apps.map(app => (
              <div key={app.id} onClick={() => { setActiveAppId(app.id); setView('app'); }} className="bg-white p-5 rounded-3xl shadow-xl relative cursor-pointer hover:scale-[1.02] transition-transform group">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4 shadow-md flex items-center justify-center text-white font-bold text-xl">
                    {app.title.charAt(0)}
                </div>
                <h3 className="font-bold text-slate-900 truncate mb-1">{app.title}</h3>
                <p className="text-xs text-slate-400">Micro-App</p>
                <button onClick={(e) => deleteApp(app.id, e)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors p-2">
                    <Trash2 size={16}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TOGGLE BUTTON: Fixed to be MUCH higher up (bottom-48) */}
      {view !== 'dock' && (
        <button 
            onClick={() => setView(view === 'chat' ? 'app' : 'chat')} 
            className="fixed bottom-48 right-6 bg-slate-900 text-white p-4 rounded-full shadow-2xl z-30 hover:scale-105 transition-transform active:scale-95 border border-white/10"
        >
          {view === 'chat' ? <Smartphone size={24} /> : <MessageSquare size={24} />}
        </button>
      )}

      {/* SETTINGS MODAL */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <form onSubmit={saveKey} className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl relative overflow-hidden">
                <h2 className="text-2xl font-bold mb-2 text-slate-900">Unlock Fluid OS</h2>
                <input 
                    name="key" 
                    type="password" 
                    defaultValue={apiKey}
                    placeholder="AIzaSy..." 
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                />
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg">Start Engine</button>
            </form>
        </div>
      )}
    </div>
  );
}
