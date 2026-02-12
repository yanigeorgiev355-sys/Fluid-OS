import React, { useState, useEffect, useRef } from 'react';
import { Send, Menu, Settings, X, Activity, Sparkles } from 'lucide-react';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import A2UIRenderer from './A2UIRenderer';

const GEMINI_MODEL_VERSION = "gemini-2.0-flash"; 

// --- THE STABLE SCHEMA ---
// We removed deep recursion to fix the "non-empty" error.
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    thought: { type: SchemaType.STRING, description: "Internal reasoning." },
    response: { type: SchemaType.STRING, description: "Response to user." },
    tool: {
      type: SchemaType.OBJECT,
      nullable: true,
      properties: {
        type: { type: SchemaType.STRING }, // Main container (Card)
        props: {
          type: SchemaType.OBJECT,
          nullable: true,
          properties: {
            title: { type: SchemaType.STRING, nullable: true },
            subtitle: { type: SchemaType.STRING, nullable: true }
          }
        },
        children: {
          type: SchemaType.ARRAY,
          nullable: true,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              // Level 2 Components (Text, Gauge, Buttons)
              type: { 
                type: SchemaType.STRING,
                enum: ["Text", "Gauge", "ButtonRow", "Chart"] 
              },
              props: {
                type: SchemaType.OBJECT,
                nullable: true,
                properties: {
                  content: { type: SchemaType.STRING, nullable: true },
                  label: { type: SchemaType.STRING, nullable: true },
                  value: { type: SchemaType.NUMBER, nullable: true },
                  max: { type: SchemaType.NUMBER, nullable: true },
                  unit: { type: SchemaType.STRING, nullable: true },
                  style: { type: SchemaType.STRING, nullable: true },
                  actions: {
                    type: SchemaType.ARRAY,
                    nullable: true,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        label: { type: SchemaType.STRING },
                        action: { type: SchemaType.STRING },
                        payload: { type: SchemaType.STRING, nullable: true }
                      }
                    }
                  }
                }
              }
              // We REMOVED the 'children' property here to stop the error loop.
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
- Use the "tool" field ONLY if you need to render a UI widget.
- PREFER the 'Gauge' component for tracking water/progress.
- PREFER 'ButtonRow' for actions.
- Otherwise set "tool" to null.
`;

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [messages, setMessages] = useState([{ role: 'model', text: "Hello! I am your Neural OS. Ready to help." }]);
  const [input, setInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(!apiKey);
  const [tools, setTools] = useState([]); 
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages, loading]);

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
          responseSchema: RESPONSE_SCHEMA
        } 
      });

      const chat = model.startChat({
        history: [
          { role: "user", parts: [{ text: SYSTEM_PROMPT }] }
        ],
      });

      const result = await chat.sendMessage(input);
      const responseText = result.response.text();
      console.log("Raw Response:", responseText);

      const data = JSON.parse(responseText);
      
      const aiMessage = { 
        role: 'model', 
        text: data.response, 
        tool: data.tool 
      };

      setMessages(prev => [...prev, aiMessage]);

      if (data.tool) {
        setTools(prev => [...prev, data.tool]);
        setDrawerOpen(true); 
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
    localStorage.setItem('gemini_key', key);
    setApiKey(key);
    setSettingsOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* LEFT: CHAT AREA */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full bg-white shadow-xl border-x border-slate-200">
        <div className="p-4 border-b flex justify-between items-center bg-white z-10">
          <span className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Activity size={20} className="text-blue-600"/> Neural OS
            <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded">v{GEMINI_MODEL_VERSION}</span>
          </span>
          <div className="flex gap-2">
            <button onClick={() => setSettingsOpen(true)} className="p-2 hover:bg-slate-100 rounded-full transition"><Settings size={20} className="text-slate-600"/></button>
            <button onClick={() => setDrawerOpen(!drawerOpen)} className="p-2 hover:bg-slate-100 rounded-full lg:hidden"><Menu size={20} className="text-slate-600"/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-5 py-3 rounded-2xl max-w-[85%] shadow-sm ${
                m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 
                m.role === 'system' ? 'bg-red-50 text-red-600 text-xs border border-red-100' : 'bg-slate-100 text-slate-800 rounded-bl-none'
              }`}>
                {m.text}
              </div>
              {m.tool && (
                <div className="mt-3 w-full max-w-[85%] animate-in fade-in slide-in-from-bottom-2">
                  <A2UIRenderer blueprint={m.tool} onAction={(action, pl) => alert(`Action: ${action} Payload: ${pl}`)} />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm ml-4 mt-2">
              <Sparkles size={16} className="animate-spin" /> Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t flex gap-2">
          <input 
            className="flex-1 bg-slate-100 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={!apiKey}
          />
          <button onClick={handleSend} disabled={!apiKey} className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md">
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* RIGHT: TOOL DRAWER */}
      <div className={`${drawerOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0 fixed lg:relative inset-y-0 right-0 w-80 bg-slate-50 border-l border-slate-200 transform transition-transform duration-300 z-20 shadow-2xl lg:shadow-none`}>
        <div className="p-4 font-bold text-slate-500 text-xs uppercase tracking-wider flex justify-between items-center border-b bg-slate-50">
          <span>Your Tools</span>
          <button onClick={() => setDrawerOpen(false)} className="lg:hidden p-1 hover:bg-slate-200 rounded"><X size={18}/></button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto h-[calc(100vh-60px)] pb-20">
          {tools.length === 0 && <div className="text-slate-400 text-sm text-center mt-10">No tools yet.<br/>Ask the AI to build one!</div>}
          {tools.map((tool, idx) => (
            <div key={idx} className="hover:ring-2 ring-blue-400 rounded-xl transition cursor-pointer bg-white p-1 shadow-sm border border-slate-100">
               <A2UIRenderer blueprint={tool} onAction={() => {}} />
            </div>
          ))}
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <form onSubmit={saveKey} className="bg-white p-8 rounded-2xl w-96 shadow-2xl">
            <h2 className="text-xl font-bold mb-2 text-slate-800">Setup Gemini API</h2>
            <p className="text-sm text-slate-500 mb-6">Enter your Google AI Studio key. It is stored locally in your browser.</p>
            <input name="key" type="password" placeholder="AIzaSy..." defaultValue={apiKey} className="w-full border border-slate-300 p-3 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none" />
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">Save & Start</button>
            <button type="button" onClick={() => setSettingsOpen(false)} className="w-full mt-3 text-slate-500 text-sm hover:underline">Close</button>
          </form>
        </div>
      )}
    </div>
  );
}
