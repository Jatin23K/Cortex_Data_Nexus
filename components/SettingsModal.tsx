import React, { useState, useRef } from 'react';
import { X, FileText, Upload, Trash2, Database, Key, BookOpen, RefreshCw, CheckCircle2, Thermometer, Library, Edit2, Save, RotateCcw, FolderOpen, FileCode, FileJson, FileSpreadsheet } from 'lucide-react';
import { KnowledgeDocument, Persona, PersonaKey } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Global KB
  globalKB: KnowledgeDocument[];
  onUploadGlobal: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveGlobal: (id: string) => void;
  onRefreshGlobal: () => void;

  // Project Files
  projectFiles: KnowledgeDocument[];
  onUploadProject: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveProject: (id: string) => void;

  temperature: number;
  onTemperatureChange: (temp: number) => void;
  customModelId: string;
  setCustomModelId: (id: string) => void;
  personas: Record<PersonaKey, Persona>;
  onUpdatePersona: (key: PersonaKey, p: Persona) => void;
  onResetPersona: (key: PersonaKey) => void;
}

type Tab = 'knowledge' | 'api' | 'roles' | 'project';

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  globalKB, 
  onUploadGlobal, 
  onRemoveGlobal,
  onRefreshGlobal,
  projectFiles,
  onUploadProject,
  onRemoveProject,
  temperature,
  onTemperatureChange,
  customModelId,
  setCustomModelId,
  personas,
  onUpdatePersona,
  onResetPersona
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('knowledge');
  const [apiProvider, setApiProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const kbInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  // Editing state
  const [editingKey, setEditingKey] = useState<PersonaKey | null>(null);
  const [editForm, setEditForm] = useState<Persona | null>(null);

  if (!isOpen) return null;

  const handleStartEdit = (p: Persona) => {
    setEditingKey(p.key);
    setEditForm({ ...p });
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    if (editForm && editingKey) {
      onUpdatePersona(editingKey, editForm);
      // Clear state after update to return to view mode with new data
      setEditingKey(null);
      setEditForm(null);
    }
  };

  const handleEditChange = (field: keyof Persona, value: string) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'json') return <FileJson size={20} className="text-orange-400" />;
    if (ext === 'csv' || ext === 'xlsx') return <FileSpreadsheet size={20} className="text-green-400" />;
    if (['js', 'ts', 'py', 'html', 'css', 'tsx', 'sql', 'yaml'].includes(ext || '')) return <FileCode size={20} className="text-blue-400" />;
    return <FileText size={20} className="text-gray-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f1117] w-full max-w-5xl h-[85vh] rounded-2xl border border-cortex-700 shadow-2xl flex flex-col md:flex-row overflow-hidden">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-cortex-900 border-r border-cortex-800 p-4 flex flex-col">
           <h2 className="text-lg font-bold text-white mb-6 px-2">Settings</h2>
           <nav className="space-y-2 flex-1">
              <button 
                onClick={() => setActiveTab('knowledge')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeTab === 'knowledge' ? 'bg-cortex-800 text-white border border-cortex-700' : 'text-gray-400 hover:text-gray-200 hover:bg-cortex-800/50'}`}
              >
                <Database size={18} className={activeTab === 'knowledge' ? 'text-cortex-blue' : ''}/>
                <span className="text-sm font-medium">Knowledge Base</span>
              </button>
              <button 
                onClick={() => setActiveTab('api')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeTab === 'api' ? 'bg-cortex-800 text-white border border-cortex-700' : 'text-gray-400 hover:text-gray-200 hover:bg-cortex-800/50'}`}
              >
                <Key size={18} className={activeTab === 'api' ? 'text-cortex-blue' : ''}/>
                <span className="text-sm font-medium">Connected API</span>
              </button>
              <button 
                onClick={() => setActiveTab('roles')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeTab === 'roles' ? 'bg-cortex-800 text-white border border-cortex-700' : 'text-gray-400 hover:text-gray-200 hover:bg-cortex-800/50'}`}
              >
                <BookOpen size={18} className={activeTab === 'roles' ? 'text-cortex-blue' : ''}/>
                <span className="text-sm font-medium">Role Specs</span>
              </button>
              <button 
                onClick={() => setActiveTab('project')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeTab === 'project' ? 'bg-cortex-800 text-white border border-cortex-700' : 'text-gray-400 hover:text-gray-200 hover:bg-cortex-800/50'}`}
              >
                <FolderOpen size={18} className={activeTab === 'project' ? 'text-cortex-blue' : ''}/>
                <span className="text-sm font-medium">Project Files</span>
              </button>
           </nav>
           
           <div className="mt-auto pt-4 border-t border-cortex-800">
             <button onClick={onClose} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-cortex-700 hover:bg-cortex-800 text-gray-400 hover:text-white transition-colors text-sm">
               <X size={16} /> Close
             </button>
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[#0d1117] overflow-hidden flex flex-col relative">
           
           {/* Tab: Knowledge Base (Global) */}
           {activeTab === 'knowledge' && (
             <div className="flex flex-col h-full p-6 md:p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                   <div>
                     <h3 className="text-2xl font-bold text-white">Knowledge Base</h3>
                     <p className="text-cortex-500 text-sm mt-1">Manage persistent global data (ML concepts, Agency Guidelines) accessible to all Agents.</p>
                   </div>
                   <button 
                     onClick={onRefreshGlobal} 
                     className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cortex-800 hover:bg-cortex-700 text-cortex-blue border border-cortex-700 transition-colors text-sm"
                   >
                     <RefreshCw size={14} /> Sync
                   </button>
                </div>

                <div className="flex-1 bg-cortex-900/50 rounded-xl border border-cortex-800 p-1">
                   {globalKB.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-cortex-500 gap-4 opacity-60">
                        <Library size={48} strokeWidth={1} />
                        <div className="text-center">
                          <p className="text-lg font-medium">No global documents</p>
                          <p className="text-sm">Upload machine-readable files (ML theory, definitions, etc.)</p>
                        </div>
                     </div>
                   ) : (
                     <div className="space-y-1 p-2">
                        {globalKB.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between p-4 bg-cortex-800/40 border border-cortex-700/50 rounded-lg group hover:border-cortex-600 hover:bg-cortex-800 transition-all">
                             <div className="flex items-center gap-4">
                                <div className="p-2 bg-cortex-blue/10 text-cortex-blue rounded-lg">
                                  <FileText size={20} />
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-gray-200">{doc.name}</h4>
                                  <p className="text-xs text-cortex-500 uppercase font-mono mt-0.5">{doc.type} • {Math.round(doc.content.length / 1024)} KB</p>
                                </div>
                             </div>
                             <button 
                               onClick={() => onRemoveGlobal(doc.id)}
                               className="p-2 text-cortex-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                               title="Remove file"
                             >
                               <Trash2 size={16} />
                             </button>
                          </div>
                        ))}
                     </div>
                   )}
                </div>

                <div className="mt-6 border-t border-cortex-800 pt-6">
                    <input 
                      type="file" 
                      ref={kbInputRef} 
                      className="hidden" 
                      accept=".md,.txt,.csv,.json,.py,.js,.html,.xml,.ts,.sql,.yaml,.yml,.log,.ini,.conf"
                      onChange={onUploadGlobal}
                   />
                   <button 
                     onClick={() => kbInputRef.current?.click()}
                     className="w-full py-4 border-2 border-dashed border-cortex-700 rounded-xl flex flex-col items-center justify-center text-cortex-500 hover:text-cortex-blue hover:border-cortex-blue hover:bg-cortex-blue/5 transition-all group gap-2"
                   >
                     <div className="p-2 rounded-full bg-cortex-800 group-hover:bg-cortex-blue/20 transition-colors">
                       <Upload size={24} />
                     </div>
                     <span className="font-medium">Add to Global Knowledge Base</span>
                   </button>
                </div>
             </div>
           )}

           {/* Tab: Connected API */}
           {activeTab === 'api' && (
             <div className="p-6 md:p-8 overflow-y-auto h-full">
                <h3 className="text-2xl font-bold text-white mb-2">Connected APIs</h3>
                <p className="text-cortex-500 text-sm mb-8">Configure the Large Language Models powering Cortex.</p>

                <div className="grid gap-6 max-w-2xl">
                   
                   {/* Provider Selection */}
                   <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-300">AI Provider</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['gemini', 'openai', 'llama'].map(provider => (
                          <button 
                            key={provider}
                            onClick={() => setApiProvider(provider)}
                            className={`py-3 px-4 rounded-lg border capitalize font-medium transition-all ${
                              apiProvider === provider 
                               ? 'bg-cortex-blue/10 border-cortex-blue text-cortex-blue' 
                               : 'bg-cortex-800 border-cortex-700 text-gray-400 hover:bg-cortex-700'
                            }`}
                          >
                            {provider}
                          </button>
                        ))}
                      </div>
                   </div>

                   {/* API Key Input */}
                   <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-300 flex items-center justify-between">
                        <span>API Key</span>
                        {apiProvider === 'gemini' && (
                          <span className="text-xs font-normal text-cortex-accent flex items-center gap-1">
                            <CheckCircle2 size={12} /> System ENV Detected
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <input 
                          type="password" 
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={apiProvider === 'gemini' ? 'Using process.env.API_KEY (Secure)' : 'sk-...'}
                          className="w-full bg-cortex-900 border border-cortex-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-cortex-blue focus:ring-1 focus:ring-cortex-blue focus:outline-none placeholder-gray-600"
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                          <Key size={16} />
                        </div>
                      </div>
                   </div>

                   {/* Custom Model ID */}
                   <div className="space-y-2 pt-4 border-t border-cortex-800 mt-2">
                      <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <Library size={16}/>
                        Custom Tuned Model ID
                      </label>
                      <input 
                         type="text" 
                         value={customModelId}
                         onChange={(e) => setCustomModelId(e.target.value)}
                         placeholder="tunedModels/..."
                         className="w-full bg-black/30 border border-cortex-700 rounded-lg px-4 py-3 text-sm text-white placeholder-cortex-600 focus:border-cortex-blue focus:outline-none font-mono"
                       />
                       <p className="text-xs text-cortex-500">
                         Required only when using the <strong>Neural Library (SLM)</strong> persona.
                       </p>
                   </div>

                   {/* Temperature Control */}
                   <div className="space-y-4 pt-4 border-t border-cortex-800 mt-2">
                      <label className="text-sm font-semibold text-gray-300 flex items-center justify-between">
                         <span className="flex items-center gap-2"><Thermometer size={16}/> Model Temperature</span>
                         <span className="text-cortex-blue bg-cortex-blue/10 px-2 py-0.5 rounded text-xs font-mono">{temperature.toFixed(1)}</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
                        className="w-full h-2 bg-cortex-800 rounded-lg appearance-none cursor-pointer accent-cortex-blue"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                         <span>Precise (0.0)</span>
                         <span>Creative (1.0)</span>
                      </div>
                      <p className="text-xs text-cortex-500">
                        Higher values make the model more creative but less deterministic.
                      </p>
                   </div>

                   <div className="pt-6 border-t border-cortex-800">
                      <button className="bg-cortex-blue hover:bg-cortex-accentHover text-white px-6 py-2.5 rounded-lg font-medium transition-colors w-full md:w-auto">
                        Save Configuration
                      </button>
                   </div>
                </div>
             </div>
           )}

           {/* Tab: Role Specs */}
           {activeTab === 'roles' && (
             <div className="flex flex-col h-full p-6 md:p-8 overflow-hidden">
                <h3 className="text-2xl font-bold text-white mb-2">Role Specifications</h3>
                <p className="text-cortex-500 text-sm mb-6">Customize the system prompts and capabilities of the Cortex Workforce.</p>
                
                <div className="flex-1 overflow-y-auto pr-2 pb-10">
                  <div className="grid grid-cols-1 gap-4">
                    {Object.values(personas).map((persona) => (
                      <div 
                        key={persona.key} 
                        className={`rounded-xl border p-5 relative overflow-hidden transition-all ${editingKey === persona.key ? 'bg-cortex-800 border-cortex-600 ring-1 ring-cortex-500' : 'border-cortex-700/50 bg-[#161b22]/60'}`}
                        style={{ 
                           borderColor: editingKey === persona.key ? undefined : `${persona.color}40`
                        }}
                      >
                        {persona.key === PersonaKey.ORCHESTRATOR && editingKey !== persona.key && (
                           <div className="absolute inset-0 bg-gradient-to-br from-cortex-900 to-cortex-800 -z-10" />
                        )}

                        {editingKey === persona.key && editForm ? (
                          /* EDIT MODE */
                          <div className="space-y-4 animate-in fade-in zoom-in-95">
                             <div className="flex items-center gap-3 mb-2">
                               <div className="p-2 rounded-lg" style={{ backgroundColor: `${persona.color}20`, color: persona.color }}>
                                  <persona.icon size={20} />
                               </div>
                               <h4 className="text-lg font-bold text-white">Editing {persona.name}</h4>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-gray-400 mb-1">Display Name</label>
                                  <input 
                                    type="text" 
                                    value={editForm.name} 
                                    onChange={(e) => handleEditChange('name', e.target.value)}
                                    className="w-full bg-black/30 border border-cortex-700 rounded px-3 py-2 text-sm text-white focus:border-cortex-blue focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                                  <input 
                                    type="text" 
                                    value={editForm.title} 
                                    onChange={(e) => handleEditChange('title', e.target.value)}
                                    className="w-full bg-black/30 border border-cortex-700 rounded px-3 py-2 text-sm text-white focus:border-cortex-blue focus:outline-none"
                                  />
                                </div>
                             </div>

                             <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                                <textarea 
                                  value={editForm.description} 
                                  onChange={(e) => handleEditChange('description', e.target.value)}
                                  className="w-full bg-black/30 border border-cortex-700 rounded px-3 py-2 text-sm text-white focus:border-cortex-blue focus:outline-none h-16 resize-none"
                                />
                             </div>

                             <div>
                                <label className="block text-xs font-medium text-cortex-blue mb-1">System Instruction (Prompt)</label>
                                <textarea 
                                  value={editForm.systemInstruction} 
                                  onChange={(e) => handleEditChange('systemInstruction', e.target.value)}
                                  className="w-full bg-black/30 border border-cortex-600 rounded px-3 py-3 text-xs font-mono text-gray-300 focus:border-cortex-blue focus:outline-none h-64 resize-y leading-relaxed"
                                />
                             </div>

                             <div className="flex items-center justify-between pt-2">
                                <button 
                                  type="button"
                                  onClick={() => onResetPersona(persona.key)}
                                  className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium text-cortex-500 hover:text-white hover:bg-cortex-700 transition-colors"
                                  title="Reset to System Default"
                                >
                                  <RotateCcw size={14}/> Reset Default
                                </button>
                                <div className="flex gap-2">
                                  <button 
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-4 py-2 rounded bg-cortex-700 hover:bg-cortex-600 text-white text-xs font-bold transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={handleSaveEdit}
                                    className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-colors"
                                  >
                                    <Save size={14} /> Save Changes
                                  </button>
                                </div>
                             </div>
                          </div>
                        ) : (
                          /* VIEW MODE */
                          <>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div 
                                   className="p-2.5 rounded-lg"
                                   style={{ backgroundColor: `${persona.color}20`, color: persona.color }}
                                >
                                  <persona.icon size={20} />
                                </div>
                                <div>
                                  <h3 className="font-bold text-white">{persona.name}</h3>
                                  <div className="text-xs font-mono" style={{ color: persona.color }}>{persona.title}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="px-2 py-1 rounded text-[10px] font-mono border text-white/70 uppercase"
                                  style={{ borderColor: `${persona.color}30`, backgroundColor: `${persona.color}10` }}
                                >
                                  {persona.modelPreference === 'reasoning' ? 'High IQ' : persona.modelPreference === 'custom' ? 'Tuned' : 'Fast'}
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => handleStartEdit(persona)}
                                  className="p-1.5 hover:bg-cortex-700 rounded text-gray-400 hover:text-white transition-colors"
                                  title="Edit Role Spec"
                                >
                                  <Edit2 size={14} />
                                </button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-400 mb-3">{persona.description}</p>
                            <div className="bg-black/30 rounded p-3 border border-cortex-700/50 group-hover:border-cortex-600 transition-colors">
                               <div className="text-[10px] font-bold text-cortex-500 uppercase mb-1 flex justify-between">
                                 <span>System Prompt Extract</span>
                               </div>
                               <p className="text-[11px] text-gray-500 font-mono line-clamp-3 leading-relaxed">
                                 {persona.systemInstruction
                                    .replace(/You are a .*?\./, '') 
                                    .trim()}
                               </p>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
             </div>
           )}

            {/* Tab: Project Files (Active Context) */}
            {activeTab === 'project' && (
             <div className="flex flex-col h-full p-6 md:p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                   <div>
                     <h3 className="text-2xl font-bold text-white">Project Files</h3>
                     <p className="text-cortex-500 text-sm mt-1">Manage active data sources and specs for the current project. These change with every project.</p>
                   </div>
                </div>

                <div className="flex-1 bg-cortex-900/50 rounded-xl border border-cortex-800 p-1">
                   {projectFiles.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-cortex-500 gap-4 opacity-60">
                        <FolderOpen size={48} strokeWidth={1} />
                        <div className="text-center">
                          <p className="text-lg font-medium">No project files</p>
                          <p className="text-sm">Upload data files (CSV, JSON), logs, or project specs.</p>
                        </div>
                     </div>
                   ) : (
                     <div className="space-y-1 p-2">
                        {projectFiles.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between p-4 bg-cortex-800/40 border border-cortex-700/50 rounded-lg group hover:border-cortex-600 hover:bg-cortex-800 transition-all">
                             <div className="flex items-center gap-4">
                                <div className="p-2 bg-cortex-blue/10 text-cortex-blue rounded-lg">
                                  {getFileIcon(doc.name)}
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-gray-200">{doc.name}</h4>
                                  <p className="text-xs text-cortex-500 uppercase font-mono mt-0.5">{doc.type} • {Math.round(doc.content.length / 1024)} KB</p>
                                </div>
                             </div>
                             <button 
                               onClick={() => onRemoveProject(doc.id)}
                               className="p-2 text-cortex-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                               title="Remove file"
                             >
                               <Trash2 size={16} />
                             </button>
                          </div>
                        ))}
                     </div>
                   )}
                </div>

                <div className="mt-6 border-t border-cortex-800 pt-6">
                    <input 
                      type="file" 
                      ref={projectInputRef} 
                      className="hidden" 
                      accept=".md,.txt,.csv,.json,.py,.js,.html,.xml,.ts,.tsx,.sql,.yaml,.yml,.log,.ini,.conf"
                      onChange={onUploadProject}
                   />
                   <button 
                     onClick={() => projectInputRef.current?.click()}
                     className="w-full py-4 border-2 border-dashed border-cortex-700 rounded-xl flex flex-col items-center justify-center text-cortex-500 hover:text-cortex-blue hover:border-cortex-blue hover:bg-cortex-blue/5 transition-all group gap-2"
                   >
                     <div className="p-2 rounded-full bg-cortex-800 group-hover:bg-cortex-blue/20 transition-colors">
                       <Upload size={24} />
                     </div>
                     <span className="font-medium">Add Project File</span>
                   </button>
                </div>
             </div>
           )}

        </div>

      </div>
    </div>
  );
};

export default SettingsModal;