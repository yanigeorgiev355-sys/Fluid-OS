import React, { useState, useEffect, useRef } from 'react';
import { Settings, Activity, Smartphone, MessageSquare, Grid, Plus, Trash2, X, Send, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import A2UIRenderer from './A2UIRenderer';

// CONFIGURATION
// Use 2.5-flash as the stable standard. If you have a working 2.5 key, you can swap this back.
const GEMINI_MODEL_VERSION = "gemini-2.5-flash"; 

// --- SAFETY LAYER 1: ROBUST PARSING ---
const robustJSONParse = (text) => {
  try {
    return JSON.parse(text);
  } catch (e) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch (e2) { return null; }
    }
    return null;
  }
};

const loadSavedApps = () => {
  try {
    const saved = localStorage.getItem('neural_apps');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Corrupted App Data found. Resetting...", e);
    return [];
  }
};

// --- SYSTEM PROMPT: HYBRID MODE ---
// We allow BOTH simple JSON blocks (cheap) and full HTML (fancy)
const SYSTEM_PROMPT = `
You are Fluid OS, an AI that builds micro-apps.

DECISION LOGIC:
1. IF the user needs a simple tool (calculator, tracker, list), use "BLOCKS" mode.
   - Efficient, low-token, native UI components.
2. IF the user needs a complex visual interface (dashboard, guide, marketplace), use "HTML" mode.
   - High-fidelity, Tailwind CSS, beautiful design.

MODE A: "BLOCKS" (JSON)
Use these keys: { "t": "Header"|"Stat"|"Btn"|"Text"|"Divider", "label": "...", "value": "...", "onClick": "action_id" }

MODE B: "HTML" (String)
- Generate a SINGLE string of raw HTML.
- USE TAILWIND CSS for all styling.
- DO NOT include <html>, <head>, or <body> tags. Just the internal content.
- Use Lucide-react style SVG icons inline if needed.
- Make it look like a high-end "Stitch" design (soft shadows, rounded corners, generous padding).

OUTPUT FORMAT (JSON):
{
  "thought": "Reasoning here...",
  "response": "Chat reply to user...",
  "tool": {
    "title": "App Name",
    "mode": "blocks" OR "html",
    "blocks": [ ...array of blocks... ], 
    "html": "...raw html string..."
  }
}
`;

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [apps, setApps] = useState(loadSavedApps);
  
  const [messages, setMessages] = useState([{ role: 'model', text: "Ready. What shall we build?" }]);
  const [input, setInput] = useState('');
  const [activeAppId, setActiveAppId] = useState(null); 
  const [view, setView] = useState('chat'); 
  const [loading, setLoading] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState(0); 
  const [settingsOpen, setSettingsOpen] = useState(!apiKey);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('neural_apps', JSON.stringify(apps));
    } catch (e) {
      console.error("Failed to save apps", e);
    }
  }, [apps]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  useEffect(() => {
    if (rateLimitTimer > 0) {
      const timer = setInterval(() => setRateLimitTimer(t => t - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [rateLimitTimer]);

  const activeApp = apps.find(a => a.id === activeAppId);

  // Handle clicks inside the generated apps
  const handleAppAction = async (actionId, payload) => {
    if (rateLimitTimer > 0) return; 
    
    // If it's an HTML app, we might need different logic, but for now we treat string messages as actions
    const actionPrompt = `[USER INTERACTION]: Clicked "${actionId}" with value "${payload}".\nTASK: Update the interface state accordingly.`;
    handleSend(actionPrompt, true); 
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
          responseMimeType: "application/json" 
          // Note: We removed the strict schema validation here to give the AI 
          // more freedom to generate complex HTML strings without validation errors.
        } 
      });

      let dynamicPrompt = SYSTEM_PROMPT;
      if (activeApp) {
        dynamicPrompt += `\n[CURRENT APP STATE]:
        Title: ${activeApp.title}
        Mode: ${activeApp.blueprint.mode || 'blocks'}
        Data: ${JSON.stringify(activeApp.blueprint.blocks || "HTML Mode Active")}
        \nINSTRUCTION: Apply action "${textToSend}" to this state. Return the NEW complete tool object.`;
      }

      // --- CRITICAL FIX: HISTORY FILTERING ---
      // Gemini throws 400 if history starts with 'model'. We filter it out.
      const historyForGemini = messages
        .filter(m => m.role !== 'system')
        // Filter out the very first message if it is from the model
        .filter((msg, index) => !(index === 0 && msg.role === 'model'))
        .map(m => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.text }]
        }));

      const chat = model.startChat({ history: historyForGemini });
      const result = await chat.sendMessage(textToSend);
      const responseText = result.response.text();
      const data = robustJSONParse(responseText);

      if (!data) {
          setMessages(prev => [...prev, { role: 'model', text: "I tried to build that, but I made a syntax error. Please ask again." }]);
      } else {
          if (data.response && !isSystemAction) {
              setMessages(prev => [...prev, { role: 'model', text: data.response }]);
          }
          
          if (data.tool) {
            const newToolTitle = data.tool.title || activeApp?.title || "New App";
            // Ensure mode is set
            if (!data.tool.mode) data.tool.mode = data.tool.html ? 'html' : 'blocks';

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
      console.error(e);
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

  const handleReset = () => {
    if(window.confirm("This will delete all apps and reset the tool. Are you sure?")) {
        localStorage.removeItem('neural_apps');
        setApps([]);
        setView('chat');
        setMessages([{ role: 'model', text: "System Reset Complete. Ready." }]);
        setSettingsOpen(false);
    }
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

        {/* INPUT AREA */}
        <div className="p-3 border-t bg-white flex gap-2 items-end pb-8">
          <textarea 
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 resize-none font-sans text-sm" 
            rows={3}
            placeholder={rateLimitTimer > 0 ? "Waiting..." : "Describe an app..."} 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            disabled={rateLimitTimer > 0} 
            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
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
        
        {/* APP CONTAINER */}
        <div className="flex-1 overflow-hidden relative">
          {loading && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-5 py-2 rounded-full text-xs font-bold z-50 flex items-center gap-2 shadow-2xl backdrop-blur-sm">
                <Loader2 size={14} className="animate-spin text-blue-400"/> UPDATING...
            </div>
          )}

          <div className="h-full w-full overflow-y-auto custom-scrollbar">
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
                <p className="text-xs text-slate-400">{app.blueprint.mode === 'html' ? 'Pro App' : 'Basic App'}</p>
                <button onClick={(e) => deleteApp(app.id, e)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors p-2">
                    <Trash2 size={16}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {view !== 'dock' && (
        <button 
            onClick={() => setView(view === 'chat' ? 'app' : 'chat')} 
            className="fixed bottom-8 right-6 bg-slate-900 text-white p-4 rounded-full shadow-2xl z-30 hover:scale-105 transition-transform active:scale-95 border border-white/10"
        >
          {view === 'chat' ? <Smartphone size={24} /> : <MessageSquare size={24} />}
        </button>
      )}

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
                <div className="mt-8 pt-6 border-t border-slate-100">
                    <button type="button" onClick={handleReset} className="w-full flex items-center justify-center gap-2 text-red-500 text-sm font-medium hover:bg-red-50 p-3 rounded-lg transition-colors">
                        <RefreshCw size={16}/> Reset All App Data
                    </button>
                </div>
            </form>
        </div>
      )}
    </div>
  );
}
