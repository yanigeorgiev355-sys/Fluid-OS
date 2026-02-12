import React, { useState, useEffect } from 'react';
import { Send, Menu, Settings, X, Activity } from 'lucide-react';
import OpenAI from 'openai';
import A2UIRenderer from './A2UIRenderer';

// --- SYSTEM PROMPT (The "A2UI" Instructions) ---
const SYSTEM_PROMPT = `
You are an Agentic OS. You do not write React code. You respond in JSON format ONLY when a tool is needed.
If the user needs a tool (tracker, chart, list), output a JSON object with this structure:
{
  "text": "Your helpful text response here...",
  "tool": {
    "type": "Card",
    "props": { "title": "Tool Title" },
    "children": [ ... components like Gauge, ButtonRow, Chart, Text ... ]
  }
}
If no tool is needed, just output plain text.
`;

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_key') || '');
  const [messages, setMessages] = useState([{ role: 'assistant', text: "Hello! I am your Neural OS. Add your API Key in settings to start." }]);
  const [input, setInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(!apiKey);
  const [tools, setTools] = useState([]); // This is your "Tool Drawer"
  const [loading, setLoading] = useState(false);

  // --- HANDLE SENDING MESSAGE ---
  const handleSend = async () => {
    if (!input.trim() || !apiKey) return;
    
    const newMsgs = [...messages, { role: 'user', text: input }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });
      
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...newMsgs.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }))
        ],
        model: "gpt-4-turbo", // Or gpt-3.5-turbo
        response_format: { type: "json_object" }, // FORCE JSON MODE
      });

      const responseContent = JSON.parse(completion.choices[0].message.content);
      
      // Handle the AI response
      const aiMessage = { 
        role: 'assistant', 
        text: responseContent.text || "Here is your tool.",
        tool: responseContent.tool 
      };

      setMessages(prev => [...prev, aiMessage]);

      // If the AI generated a tool, save it to the "Drawer" automatically
      if (responseContent.tool) {
        setTools(prev => [...prev, responseContent.tool]);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'system', text: "Error: " + error.message }]);
    }
    setLoading(false);
  };

  const saveKey = (e) => {
    e.preventDefault();
    const key = e.target.elements.key.value;
    localStorage.setItem('openai_key', key);
    setApiKey(key);
    setSettingsOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* LEFT: CHAT AREA */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full bg-white shadow-xl border-x">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <span className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Activity size={20} className="text-blue-600"/> Neural OS
          </span>
          <div className="flex gap-2">
            <button onClick={() => setSettingsOpen(true)} className="p-2 hover:bg-slate-200 rounded-full"><Settings size={20}/></button>
            <button onClick={() => setDrawerOpen(!drawerOpen)} className="p-2 hover:bg-slate-200 rounded-full lg:hidden"><Menu size={20}/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-3 rounded-2xl max-w-[85%] ${
                m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 
                m.role === 'system' ? 'bg-red-100 text-red-800 text-xs' : 'bg-slate-100 text-slate-800 rounded-bl-none'
              }`}>
                {m.text}
              </div>
              {/* RENDER THE TOOL IF PRESENT */}
              {m.tool && (
                <div className="mt-2 w-full max-w-[85%]">
                  <A2UIRenderer blueprint={m.tool} onAction={(action, pl) => alert(`Action: ${action} Payload: ${pl}`)} />
                </div>
              )}
            </div>
          ))}
          {loading && <div className="text-slate-400 text-sm ml-4">Thinking...</div>}
        </div>

        <div className="p-4 bg-white border-t flex gap-2">
          <input 
            className="flex-1 bg-slate-100 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe a tool (e.g. 'I need a water tracker')..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={!apiKey}
          />
          <button onClick={handleSend} disabled={!apiKey} className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50">
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* RIGHT: TOOL DRAWER */}
      <div className={`${drawerOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0 fixed lg:relative inset-y-0 right-0 w-80 bg-slate-50 border-l border-slate-200 transform transition-transform duration-300 z-20`}>
        <div className="p-4 font-bold text-slate-500 text-sm uppercase flex justify-between">
          <span>Your Tools</span>
          <button onClick={() => setDrawerOpen(false)} className="lg:hidden"><X size={20}/></button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto h-full pb-20">
          {tools.length === 0 && <div className="text-slate-400 text-sm">No tools yet. Ask the AI to build one!</div>}
          {tools.map((tool, idx) => (
            <div key={idx} className="hover:ring-2 ring-blue-400 rounded-xl transition cursor-pointer bg-white p-2 shadow-sm">
               <A2UIRenderer blueprint={tool} onAction={() => {}} />
            </div>
          ))}
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form onSubmit={saveKey} className="bg-white p-6 rounded-xl w-96 shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Setup API Key</h2>
            <p className="text-sm text-slate-500 mb-4">Your key is stored in your browser, not on GitHub.</p>
            <input name="key" type="password" placeholder="sk-..." defaultValue={apiKey} className="w-full border p-2 rounded mb-4" />
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold">Save & Start</button>
            <button type="button" onClick={() => setSettingsOpen(false)} className="w-full mt-2 text-slate-500 text-sm">Close</button>
          </form>
        </div>
      )}
    </div>
  );
    }
  
