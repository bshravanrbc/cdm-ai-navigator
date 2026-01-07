
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Map as MapIcon, 
  MessageSquare, 
  Database, 
  ChevronRight, 
  ArrowRight,
  Info,
  ExternalLink,
  Code,
  UploadCloud,
  Loader2,
  Plus,
  Trash2,
  History,
  BookOpen,
  FileSpreadsheet,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { INITIAL_CDM_FIELDS } from './data/cdmFields';
import { GeminiService } from './services/geminiService';
import { dbService } from './services/dbService';
import { ViewMode, CDMField, ChatMessage, MappingSuggestion, ChatSession } from './types';

const PAGE_SIZE = 50;

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.EXPLORER);
  const [searchTerm, setSearchTerm] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [mappingInput, setMappingInput] = useState('');
  const [isMapping, setIsMapping] = useState(false);
  const [mappingResults, setMappingResults] = useState<MappingSuggestion[]>([]);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // DB & Explorer State
  const [dbFields, setDbFields] = useState<CDMField[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [dbTotalCount, setDbTotalCount] = useState(0);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const gemini = useMemo(() => new GeminiService(), []);

  // Initialize DB and load initial data
  useEffect(() => {
    const init = async () => {
      await dbService.init();
      const count = await dbService.getCount();
      setDbTotalCount(count);
      
      if (count > 0) {
        handleSearch('', 0, false);
      } else {
        setIsIndexing(true);
        await dbService.addFields(INITIAL_CDM_FIELDS);
        const newCount = await dbService.getCount();
        setDbTotalCount(newCount);
        handleSearch('', 0, false);
        setIsIndexing(false);
      }
    };
    init();

    const saved = localStorage.getItem('cdm_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
        }
      } catch (e) { console.error(e); }
    }
  }, []);

  // Handle Search logic
  const handleSearch = async (query: string, page: number, append: boolean) => {
    setIsSearching(true);
    const result = await dbService.searchFields(query, PAGE_SIZE, page * PAGE_SIZE);
    
    if (append) {
      setDbFields(prev => [...prev, ...result.fields]);
    } else {
      setDbFields(result.fields);
    }
    
    setTotalMatches(result.total);
    setHasMore(result.hasMore);
    setIsSearching(false);
  };

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(0);
      handleSearch(searchTerm, 0, false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, dbTotalCount]);

  const loadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    handleSearch(searchTerm, nextPage, true);
  };

  useEffect(() => {
    localStorage.setItem('cdm_sessions', JSON.stringify(sessions));
  }, [sessions]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsIndexing(true);
    setIndexingProgress(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/);
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const objIdx = headers.findIndex(h => h.includes('object') || h.includes('class'));
      const fieldIdx = headers.findIndex(h => h.includes('field') || h.includes('name'));
      const labelIdx = headers.findIndex(h => h.includes('label') || h.includes('display'));
      const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('datatype'));
      const descIdx = headers.findIndex(h => h.includes('description') || h.includes('desc'));

      const newFields: CDMField[] = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        newFields.push({
          objectType: cols[objIdx] || "Unknown",
          fieldName: cols[fieldIdx] || `Field_${i}`,
          label: cols[labelIdx] || cols[fieldIdx] || "",
          type: cols[typeIdx] || "Text",
          description: cols[descIdx] || ""
        });
      }

      await dbService.clearAll();
      await dbService.addFields(newFields, (count) => {
        setIndexingProgress(Math.round((count / newFields.length) * 100));
      });
      
      const finalCount = await dbService.getCount();
      setDbTotalCount(finalCount);
      setCurrentPage(0);
      handleSearch('', 0, false);
      setIsIndexing(false);
    };
    reader.readAsText(file);
  };

  const currentSession = useMemo(() => 
    sessions.find(s => s.id === currentSessionId), 
    [sessions, currentSessionId]
  );

  const createNewSession = (initialMsg?: string) => {
    const newId = crypto.randomUUID();
    const newSession: ChatSession = {
      id: newId,
      title: initialMsg ? (initialMsg.length > 30 ? initialMsg.substring(0, 30) + '...' : initialMsg) : 'New Conversation',
      messages: [],
      createdAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setViewMode(ViewMode.ASSISTANT);
    return newId;
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (currentSessionId === id) {
        setCurrentSessionId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createNewSession(chatInput);
    }

    const userMsg: ChatMessage = { role: 'user', content: chatInput };
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length === 0 ? (chatInput.length > 30 ? chatInput.substring(0, 30) + '...' : chatInput) : s.title }
        : s
    ));
    
    setChatInput('');
    setIsAssistantLoading(true);

    try {
      const response = await gemini.askAssistant(chatInput);
      const modelMsg: ChatMessage = { role: 'model', content: response || 'No response' };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, modelMsg] } : s));
    } catch (error) {
      const errorMsg: ChatMessage = { role: 'model', content: "Error communicating with AI. Please try again." };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, errorMsg] } : s));
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const handleMapData = async () => {
    if (!mappingInput.trim()) return;
    setIsMapping(true);
    try {
      const suggestions = await gemini.getMappingSuggestions(mappingInput);
      setMappingResults(suggestions);
    } catch (error) { console.error(error); } finally { setIsMapping(false); }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-blue-600 text-white">
              <div className="flex items-center gap-2">
                <HelpCircle size={24} />
                <h2 className="text-xl font-bold">How to use CDM AI Navigator</h2>
              </div>
              <button onClick={() => setIsHelpOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <section className="space-y-3">
                <div className="flex items-center gap-3 text-blue-600">
                  <Search size={20} />
                  <h3 className="font-bold text-lg">Explorer Mode</h3>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  The Explorer allows you to search through the entire FINOS Common Domain Model. 
                  Start typing to filter over 6,000 fields instantly. You can also import your own 
                  full CDM dictionary via CSV using the "Import" button in the header.
                </p>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-3 text-emerald-600">
                  <MapIcon size={20} />
                  <h3 className="font-bold text-lg">AI Mapper</h3>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Use this to bridge your legacy data structures to the CDM standard. Paste your trade JSON 
                  or CSV headers into the left panel. Our AI will analyze the definitions and suggest 
                  the most accurate CDM field matches with reasoning and confidence scores.
                </p>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-3 text-indigo-600">
                  <MessageSquare size={20} />
                  <h3 className="font-bold text-lg">AI Assistant</h3>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  A specialized chat interface grounded in official CDM documentation. Ask complex questions 
                  about product definitions, event structures, or legal agreements. It provides verified 
                  sources and official documentation links for every answer.
                </p>
              </section>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsHelpOpen(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Database size={20} className="text-white" />
            </div>
            <span>CDM AI</span>
          </div>
          <p className="text-slate-400 text-[10px] mt-2 uppercase tracking-widest font-bold">Standard Explorer & Mapper</p>
        </div>

        <nav className="p-4 space-y-2">
          <button 
            onClick={() => setViewMode(ViewMode.EXPLORER)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${viewMode === ViewMode.EXPLORER ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Search size={18} />
            <span className="text-sm font-semibold">Explorer</span>
          </button>
          <button 
            onClick={() => setViewMode(ViewMode.MAPPER)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${viewMode === ViewMode.MAPPER ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <MapIcon size={18} />
            <span className="text-sm font-semibold">AI Mapper</span>
          </button>
          <button 
            onClick={() => { setViewMode(ViewMode.ASSISTANT); if(!currentSessionId) createNewSession(); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${viewMode === ViewMode.ASSISTANT ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <MessageSquare size={18} />
            <span className="text-sm font-semibold">AI Assistant</span>
          </button>
        </nav>

        <div className="flex-1 flex flex-col min-h-0 border-t border-slate-800 pt-4">
          <div className="px-6 mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <History size={12} />
              Recent Conversations
            </h3>
            <button onClick={() => createNewSession()} className="p-1 hover:bg-slate-800 rounded transition-colors text-blue-400">
              <Plus size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar pb-4">
            {sessions.map(s => (
              <div 
                key={s.id}
                onClick={() => { setCurrentSessionId(s.id); setViewMode(ViewMode.ASSISTANT); }}
                className={`group flex items-center justify-between px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm ${currentSessionId === s.id && viewMode === ViewMode.ASSISTANT ? 'bg-slate-800 text-white border-l-2 border-blue-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                <span className="truncate flex-1">{s.title}</span>
                <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 space-y-4">
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Local Database</p>
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span className="text-slate-300 font-mono">{dbTotalCount.toLocaleString()} Fields</span>
            </div>
          </div>
          <a href="https://cdm.finos.org/" target="_blank" className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-400 transition-colors">
            <ExternalLink size={12} />
            Official Documentation
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white shadow-2xl relative z-10">
        
        {/* Header */}
        <header className="h-16 border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-slate-800 capitalize">
              {viewMode === ViewMode.ASSISTANT ? (currentSession?.title || 'AI Assistant') : viewMode}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              {viewMode === ViewMode.EXPLORER && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-100 transition-all"
                >
                  <FileSpreadsheet size={14} />
                  Import Full CDM CSV
                </button>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv" 
                onChange={handleFileUpload} 
              />
              <button 
                onClick={() => setIsHelpOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all border border-slate-200"
              >
                <HelpCircle size={14} />
                How to use?
              </button>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm border-l border-slate-100 pl-6">
              <Info size={16} />
              <span className="font-medium">FINOS CDM Interactive</span>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#fafbfc]">
          
          {/* Explorer View */}
          {viewMode === ViewMode.EXPLORER && (
            <div className="max-w-6xl mx-auto space-y-6">
              {isIndexing && (
                <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Loader2 className="animate-spin" size={20} />
                      <span className="font-bold">Indexing CDM Dictionary...</span>
                    </div>
                    <span className="text-xs font-mono">{indexingProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-900/30 h-2 rounded-full overflow-hidden">
                    <div className="bg-white h-full transition-all duration-300" style={{ width: `${indexingProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                  </div>
                  <input 
                    type="text" 
                    placeholder={`Search through ${dbTotalCount.toLocaleString()} fields... (e.g. 'Payout', 'Identifier')`}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-lg shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {searchTerm ? `Matches for "${searchTerm}": ${totalMatches.toLocaleString()}` : `Total CDM Fields: ${dbTotalCount.toLocaleString()}`}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium italic">
                    {isSearching ? 'Scanning database...' : `Showing results 1 to ${dbFields.length}`}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">Object Type</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">Field Name</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/6">Type</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dbFields.map((field, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                        <td className="px-6 py-4"><span className="text-sm font-semibold text-slate-700">{field.objectType}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-blue-600 group-hover:underline">{field.fieldName}</span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{field.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {field.type}
                          </span>
                        </td>
                        <td className="px-6 py-4"><p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{field.description}</p></td>
                      </tr>
                    ))}
                    {dbFields.length === 0 && !isSearching && !isIndexing && (
                      <tr>
                        <td colSpan={4} className="p-20 text-center">
                          <div className="flex flex-col items-center gap-4 text-slate-400">
                            <Search size={48} className="opacity-20" />
                            <p className="font-medium">No matches found in the entire CDM dictionary.</p>
                            <p className="text-xs">Try searching for broader terms or categories.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                
                {hasMore && (
                  <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-center">
                    <button 
                      onClick={loadMore}
                      disabled={isSearching}
                      className="flex items-center gap-2 px-8 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-white hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSearching ? <Loader2 size={16} className="animate-spin" /> : <ChevronDown size={16} />}
                      Load More Results ({totalMatches - dbFields.length} remaining)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assistant View */}
          {viewMode === ViewMode.ASSISTANT && (
            <div className="max-w-4xl mx-auto h-full flex flex-col">
              <div className="flex-1 space-y-6 pb-8">
                {(!currentSession || currentSession.messages.length === 0) && (
                  <div className="text-center py-20 space-y-4">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                      <BookOpen size={36} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">CDM Documentation Assistant</h2>
                    <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Powered by Gemini 3.0 Pro with live grounding in official FINOS CDM documentation.
                    </p>
                  </div>
                )}
                {currentSession?.messages.map((chat, idx) => (
                  <div key={idx} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] p-5 rounded-2xl shadow-sm ${chat.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
                      <div className={`prose-chat text-[14px] leading-relaxed ${chat.role === 'user' ? 'text-white' : 'text-slate-800'}`}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ node, ...props }) => (
                              <a 
                                {...props} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={chat.role === 'user' ? 'text-blue-100 underline hover:text-white' : 'text-blue-600 hover:underline'}
                              />
                            )
                          }}
                        >
                          {chat.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isAssistantLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
                      <Loader2 size={16} className="animate-spin text-blue-600" />
                      <span className="text-sm text-slate-500 italic font-medium">Analyzing documentation...</span>
                    </div>
                  </div>
                )}
              </div>
              
              <form onSubmit={handleChat} className="sticky bottom-0 bg-[#fafbfc] pt-4 pb-2">
                <div className="flex gap-4 p-1 bg-white border border-slate-200 rounded-2xl shadow-lg shadow-blue-900/5">
                  <input 
                    type="text" 
                    placeholder="Ask about CDM (e.g., 'What are the main components of a Payout?')..."
                    className="flex-1 px-5 py-3.5 bg-transparent border-none focus:outline-none text-slate-800"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button type="submit" disabled={isAssistantLoading} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2">
                    <span>Send</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Mapper View */}
          {viewMode === ViewMode.MAPPER && (
            <div className="max-w-6xl mx-auto space-y-12 pb-20">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Code size={16} />
                    Source Data Structure
                  </label>
                  <div className="relative h-[450px] border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <textarea 
                      placeholder="Paste trade JSON or CSV headers here..."
                      className="w-full h-full p-6 font-mono text-sm bg-slate-900 text-emerald-400 focus:outline-none resize-none"
                      value={mappingInput}
                      onChange={(e) => setMappingInput(e.target.value)}
                    />
                  </div>
                  <button onClick={handleMapData} disabled={isMapping || !mappingInput} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-blue-500/20">
                    {isMapping ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                    {isMapping ? "AI Analyzing Mappings..." : "Map to CDM Standards"}
                  </button>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <MapIcon size={16} />
                    Mapping Suggestions
                  </label>
                  <div className="h-[450px] bg-white border border-slate-200 rounded-2xl overflow-y-auto p-4 space-y-4 shadow-inner">
                    {mappingResults.length > 0 ? (
                      mappingResults.map((result, idx) => (
                        <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 hover:border-blue-300 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                              {Math.round(result.confidence * 100)}% Match
                            </span>
                          </div>
                          <div className="flex items-center gap-3 py-1">
                            <div className="bg-slate-900 px-3 py-2 rounded text-emerald-400 text-xs font-mono flex-1 truncate">{result.sourceField}</div>
                            <ChevronRight size={16} className="text-slate-300 shrink-0" />
                            <div className="bg-blue-50 px-3 py-2 rounded text-blue-700 text-xs font-bold border border-blue-100 flex-1 truncate">{result.targetCDMField}</div>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed pt-3 border-t border-slate-50">{result.reasoning}</p>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-8">
                        <UploadCloud size={48} className="mb-4 opacity-50 text-blue-200" />
                        <h4 className="text-slate-600 font-bold mb-1">Ready for Mapping</h4>
                        <p className="text-xs leading-relaxed">Provide trade structure on the left to discover equivalent FINOS CDM data fields.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
