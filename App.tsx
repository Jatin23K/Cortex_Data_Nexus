import React, { useState, useRef, useEffect } from 'react';
import { Message, Role, PersonaKey, Attachment, KnowledgeDocument, Persona } from './types';
import { PERSONAS } from './constants';
import { streamMessage, transcribeAudio } from './services/geminiService';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import SettingsModal from './components/SettingsModal';
import { Send, StopCircle, Mic, X, Loader2, Plus, FileText, Globe, Brain, GraduationCap, Search, Image as ImageIcon, Settings, Cpu, Menu, Monitor, MonitorX, GripVertical } from 'lucide-react';

// Helper: Generate Markdown from Personas for Orchestrator Context
const generateRoleSpecsMarkdown = (personas: Record<PersonaKey, Persona>) => {
  return `# Cortex Data Nexus - Role Specifications

> **Auto-Generated**: This context is dynamically synced with your Role Settings.

${(Object.values(personas) as Persona[]).map(p => `## ${p.name}
**Title:** ${p.title}
**Description:** ${p.description}
**System Instruction:**
\`\`\`text
${p.systemInstruction}
\`\`\`
`).join('\n')}
`;
};

function App() {
  // Initialize with defaults, but we will hydrate from LS immediately in useEffect
  const [personas, setPersonas] = useState<Record<PersonaKey, Persona>>(PERSONAS);
  const [currentPersonaKey, setCurrentPersonaKey] = useState<PersonaKey>(PersonaKey.ORCHESTRATOR);
  
  // Persist Custom Model ID and Temperature
  const [customModelId, setCustomModelId] = useState(() => localStorage.getItem('cortex_custom_model_id') || '');
  const [temperature, setTemperature] = useState(() => {
    const saved = localStorage.getItem('cortex_temperature');
    return saved ? parseFloat(saved) : 0.5;
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default open on desktop
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Screen Sharing & Layout State
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(30); // Percentage width of chat panel
  const [isDragging, setIsDragging] = useState(false);
  
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Two Types of Knowledge State:
  // 1. Project Files (Dynamic, session specific, lives in Sidebar)
  const [projectFiles, setProjectFiles] = useState<KnowledgeDocument[]>([]);
  // 2. Global Knowledge Base (Persistent, lives in Settings)
  const [globalKB, setGlobalKB] = useState<KnowledgeDocument[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const personaMenuRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  // Handle screen resize for responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load Personas, messages & KB from Local Storage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('cortex_messages');
    // Load Project Files (Legacy name was cortex_kb, now mapped to project files)
    const savedProjectFiles = localStorage.getItem('cortex_kb'); 
    // Load Global KB
    const savedGlobalKB = localStorage.getItem('cortex_global_kb');
    const savedPersonas = localStorage.getItem('cortex_personas');

    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (e) {
        console.error("Failed to load messages", e);
        setInitialWelcomeMessage();
      }
    } else {
      setInitialWelcomeMessage();
    }

    if (savedProjectFiles) {
      try {
        setProjectFiles(JSON.parse(savedProjectFiles));
      } catch (e) {
        console.error("Failed to load Project Files", e);
      }
    }

    if (savedGlobalKB) {
       try {
          setGlobalKB(JSON.parse(savedGlobalKB));
       } catch (e) {
          console.error("Failed to load Global KB", e);
       }
    }

    if (savedPersonas) {
      try {
        const parsed = JSON.parse(savedPersonas);
        
        // Robust Hydration Strategy:
        // 1. Iterate over the System Defaults (PERSONAS) to ensure structure.
        // 2. If a key exists in 'parsed' (Local Storage), merge it ON TOP of default.
        // 3. Explicitly re-attach the Icon component (which cannot be stored in JSON).
        
        const hydrated: Record<string, Persona> = {};
        
        (Object.keys(PERSONAS) as PersonaKey[]).forEach((key) => {
            const defaultPersona = PERSONAS[key];
            const savedPersona = parsed[key];

            if (savedPersona) {
                // User has customized this role
                hydrated[key] = {
                    ...defaultPersona, // Base structure
                    ...savedPersona,   // User overrides (Name, Prompt, Title, etc.)
                    icon: defaultPersona.icon // Restore React Icon Component
                };
            } else {
                // Use default
                hydrated[key] = defaultPersona;
            }
        });

        setPersonas(hydrated as Record<PersonaKey, Persona>);
      } catch (e) {
        console.error("Failed to load Personas from LS", e);
        // Fallback is already set via useState(PERSONAS)
      }
    }
  }, []);

  // Persist Custom Model ID and Temperature changes
  useEffect(() => {
    localStorage.setItem('cortex_custom_model_id', customModelId);
  }, [customModelId]);

  useEffect(() => {
    localStorage.setItem('cortex_temperature', temperature.toString());
  }, [temperature]);

  // Sync Role Specs to Project Files (for Orchestrator Context) whenever Personas change
  useEffect(() => {
    const dynamicContent = generateRoleSpecsMarkdown(personas);
    
    setProjectFiles(prev => {
      const SPEC_ID = 'default-role-specs';
      // Check if it already exists and is identical to avoid loops
      const existing = prev.find(p => p.id === SPEC_ID);
      if (existing && existing.content === dynamicContent) return prev;

      const newSpec: KnowledgeDocument = {
        id: SPEC_ID,
        name: 'role_specialisation.md',
        type: 'text/markdown',
        content: dynamicContent,
        timestamp: Date.now()
      };

      // Replace or Add
      const others = prev.filter(p => p.id !== SPEC_ID);
      return [newSpec, ...others];
    });
  }, [personas]);

  // Save messages to Local Storage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('cortex_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Save Project Files to Local Storage
  useEffect(() => {
    if (projectFiles.length > 0) {
      localStorage.setItem('cortex_kb', JSON.stringify(projectFiles));
    }
  }, [projectFiles]);

  // Save Global KB to Local Storage
  useEffect(() => {
    localStorage.setItem('cortex_global_kb', JSON.stringify(globalKB));
  }, [globalKB]);


  const handleUpdatePersona = (key: PersonaKey, updatedPersona: Persona) => {
    setPersonas(prev => {
      const next = { ...prev, [key]: updatedPersona };
      // Persist immediately to Local Storage
      try {
        const storageVersion: Record<string, any> = {};
        Object.entries(next).forEach(([k, v]) => {
            // Strip the icon component before saving to avoid circular JSON issues or losing the reference
            const { icon, ...rest } = v; 
            storageVersion[k] = rest;
        });
        localStorage.setItem('cortex_personas', JSON.stringify(storageVersion));
      } catch (e) {
        console.error("Failed to save personas to local storage", e);
      }
      return next;
    });
  };

  const handleResetPersona = (key: PersonaKey) => {
    setPersonas(prev => {
      // Restore strict default for this key
      const next = { ...prev, [key]: PERSONAS[key] };
      
      try {
         const storageVersion: Record<string, any> = {};
         Object.entries(next).forEach(([k, v]) => {
             const { icon, ...rest } = v;
             storageVersion[k] = rest;
         });
         localStorage.setItem('cortex_personas', JSON.stringify(storageVersion));
      } catch(e) {
         console.error("Failed to reset persona storage", e);
      }
      
      return next;
    });
  };

  // Re-attach video stream when layout changes or screen sharing toggles
  useEffect(() => {
    if (isScreenSharing && screenVideoRef.current && screenStreamRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current;
    }
  }, [isScreenSharing]);

  // Dragging Logic for Split Pane
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !contentAreaRef.current) return;
      
      const rect = contentAreaRef.current.getBoundingClientRect();
      // Calculate new width for the Right Panel (Chat)
      // Mouse X relative to the container
      const relativeX = e.clientX - rect.left;
      
      // Percentage of width from the left
      const leftPercentage = (relativeX / rect.width) * 100;
      
      // Chat is on the right, so Chat Width = 100 - Left Width
      const newChatWidth = 100 - leftPercentage;

      // Clamp between 15% and 85%
      const clampedWidth = Math.min(Math.max(newChatWidth, 15), 85);
      
      setChatPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging]);


  const setInitialWelcomeMessage = () => {
    setMessages([{
      id: 'welcome',
      role: Role.MODEL,
      text: `**Cortex Orchestrator Online.**\n\nI am your **Technical Project Manager**. \n\n**Workflow Overview:**\n1. **Project Files (Settings)**: Upload data/specs specific to *this* project.\n2. **Knowledge Base (Settings)**: Access global reference materials (Standard ML definitions, etc.).\n\nI will use both sources to orchestrate the workflow.\n\n*How can I help scope your project today?*`,
      timestamp: Date.now(),
    }]);
  };

  const handleNewChat = () => {
    setMessages([]);
    setTimeout(() => setInitialWelcomeMessage(), 0);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (personaMenuRef.current && !personaMenuRef.current.contains(event.target as Node)) {
        setIsPersonaMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handlePersonaChange = (key: PersonaKey) => {
    if (key === currentPersonaKey) return;
    setCurrentPersonaKey(key);
    setIsPersonaMenuOpen(false);
    
    // On mobile, close sidebar after selection
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    const persona = personas[key];
    let modelInfo = '';
    if (persona.modelPreference === 'reasoning') {
      modelInfo = 'Gemini 3 Pro (Deep Thinking)';
    } else if (persona.modelPreference === 'custom') {
      modelInfo = customModelId ? `Custom Tuned Model (${customModelId})` : 'Gemini 2.5 Flash (Cost Optimized)';
    } else {
      modelInfo = 'Gemini 2.5 Flash (High Speed)';
    }

    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        role: Role.MODEL,
        text: `***Context Switched: ${persona.name} Active.***\n\nModel: ${modelInfo}\nContext: ${projectFiles.length} Project Files, ${globalKB.length} Global Docs.`,
        timestamp: Date.now()
      }
    ]);
  };

  // Handle single file attachment for chat
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        const isImage = file.type.startsWith('image/');
        setAttachment({
          type: isImage ? 'image' : 'file',
          data: base64,
          mimeType: file.type,
          fileName: file.name
        });
        setIsMenuOpen(false); // Close menu after selection
      };
      reader.readAsDataURL(file);
    }
  };

  // -- HANDLERS FOR PROJECT FILES (SETTINGS) --
  const handleUploadToProjectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;

     const reader = new FileReader();
     reader.onload = (event) => {
        const text = event.target?.result as string;
        const newDoc: KnowledgeDocument = {
           id: Date.now().toString(),
           name: file.name,
           type: file.type || 'text/plain',
           content: text,
           timestamp: Date.now()
        };
        setProjectFiles(prev => [...prev, newDoc]);
        
        setMessages(prev => [...prev, {
           id: Date.now().toString(),
           role: Role.MODEL,
           text: `*System Update: Added "${file.name}" to Project Files (Settings).*`,
           timestamp: Date.now()
        }]);
     };
     reader.readAsText(file); 
  };

  const handleRemoveFromProjectFiles = (id: string) => {
    setProjectFiles(prev => prev.filter(doc => doc.id !== id));
  };

  // -- HANDLERS FOR GLOBAL KNOWLEDGE BASE (SETTINGS) --
  const handleUploadToGlobalKB = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const newDoc: KnowledgeDocument = {
            id: Date.now().toString(),
            name: file.name,
            type: file.type || 'text/plain',
            content: text,
            timestamp: Date.now()
        };
        setGlobalKB(prev => [...prev, newDoc]);
      };
      reader.readAsText(file);
  };

  const handleRemoveFromGlobalKB = (id: string) => {
      setGlobalKB(prev => prev.filter(doc => doc.id !== id));
  };

  const handleRefreshGlobalKB = () => {
    const saved = localStorage.getItem('cortex_global_kb');
    if (saved) {
       setGlobalKB(JSON.parse(saved));
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        const audioChunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          setIsTranscribing(true);
          try {
            const text = await transcribeAudio(audioBlob);
            setInput((prev) => prev + (prev ? ' ' : '') + text);
          } catch (err) {
            console.error("Transcription failed", err);
          } finally {
            setIsTranscribing(false);
            stream.getTracks().forEach(track => track.stop());
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error accessing microphone", err);
        alert("Could not access microphone.");
      }
    }
  };

  // Screen Sharing Logic
  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    setIsScreenSharing(false);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 5 } // Low framerate is enough for snapshots
          },
          audio: false
        });
        
        screenStreamRef.current = stream;
        // Note: We set the srcObject in the useEffect when the video element is rendered
        
        // Handle user stopping stream via browser UI
        stream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error("Error starting screen share", err);
        // User cancelled or permission denied
        setIsScreenSharing(false);
      }
    }
  };

  const captureScreenSnapshot = (): Attachment | null => {
    if (!screenVideoRef.current || !isScreenSharing) return null;
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = screenVideoRef.current.videoWidth;
      canvas.height = screenVideoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      ctx.drawImage(screenVideoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Remove prefix
      
      return {
        type: 'image',
        mimeType: 'image/jpeg',
        data: base64,
        fileName: 'Screen_Snapshot.jpg'
      };
    } catch (e) {
      console.error("Failed to capture screen snapshot", e);
      return null;
    }
  };

  const handleSubmit = async () => {
    const screenSnapshot = isScreenSharing ? captureScreenSnapshot() : null;
    const activeAttachment = attachment || screenSnapshot;
    
    if ((!input.trim() && !activeAttachment) || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: input,
      timestamp: Date.now(),
      attachment: activeAttachment || undefined
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachment(null); // Clear manual attachment if sent
    setIsLoading(true);

    const botMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: botMsgId,
        role: Role.MODEL,
        text: '',
        timestamp: Date.now(),
      },
    ]);

    try {
      // Provide context about screen sharing in the prompt if applicable
      const promptText = userMsg.text || 
        (isScreenSharing && !attachment ? "I've shared my screen. Please guide me." : 
        (userMsg.attachment ? `Analyze this ${userMsg.attachment.type}` : ""));

      // Use the dynamically editable persona object
      const activePersona = personas[currentPersonaKey];

      await streamMessage(
        messages, 
        promptText,
        activePersona, 
        activeAttachment,
        (chunkText) => {
          setMessages((prev) => 
            prev.map((msg) => 
              msg.id === botMsgId ? { ...msg, text: chunkText } : msg
            )
          );
        },
        customModelId,
        temperature,
        projectFiles, // Pass Project Files (Sidebar)
        globalKB      // Pass Global KB (Settings)
      );
    } catch (error) {
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === botMsgId 
            ? { ...msg, text: "Connection Error: Unable to reach the Cortex Neural Network.", isError: true } 
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Menu option handlers
  const handleMenuOption = (action: string) => {
    if (action === 'files') {
      fileInputRef.current?.click();
    } else {
      let prefix = "";
      switch(action) {
        case 'research': prefix = "@DeepResearch "; break;
        case 'thinking': prefix = "@Thinking "; break;
        case 'study': prefix = "@Study "; break;
        case 'web': prefix = "@WebSearch "; break;
      }
      setInput(prev => prefix + prev);
      setIsMenuOpen(false);
      inputRef.current?.focus();
    }
  };

  // Render helper for persona menu item
  const renderPersonaMenuItem = (p: any) => {
     const isSelected = currentPersonaKey === p.key;
     return (
      <button 
        key={p.key}
        onClick={() => handlePersonaChange(p.key)}
        className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-cortex-700/50 transition-colors text-left group ${isSelected ? 'bg-cortex-blue/5' : ''}`}
      >
        <div 
          className="p-1.5 rounded"
          style={{ color: p.color, backgroundColor: `${p.color}15` }}
        >
          {React.createElement(p.icon, { size: 16 })}
        </div>
        <div className="flex-1">
           <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>{p.name}</div>
           <div className="text-[10px] text-gray-500 leading-tight">{p.title}</div>
        </div>
        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-cortex-blue shadow-[0_0_8px_rgba(88,166,255,0.8)]" />}
      </button>
     );
  };

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] overflow-hidden text-gray-100 font-sans">
      {/* Hidden Video for Screen Capture (Fallback if not in split mode) */}
      {!isScreenSharing && <video ref={screenVideoRef} className="hidden" autoPlay playsInline muted />}

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        
        globalKB={globalKB}
        onUploadGlobal={handleUploadToGlobalKB}
        onRemoveGlobal={handleRemoveFromGlobalKB}
        onRefreshGlobal={handleRefreshGlobalKB}

        projectFiles={projectFiles}
        onUploadProject={handleUploadToProjectFiles}
        onRemoveProject={handleRemoveFromProjectFiles}

        temperature={temperature}
        onTemperatureChange={setTemperature}
        customModelId={customModelId}
        setCustomModelId={setCustomModelId}
        personas={personas}
        onUpdatePersona={handleUpdatePersona}
        onResetPersona={handleResetPersona}
      />

      {/* Top Separator: Header */}
      <header className="h-16 bg-cortex-900 border-b border-cortex-800 flex items-center justify-between px-4 z-40 shrink-0">
        {/* Cortex / Sidebar Toggle */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex items-center gap-3 group focus:outline-none"
          title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
        >
          <div className="w-9 h-9 bg-violet-500/10 text-violet-500 rounded-lg flex items-center justify-center group-hover:bg-violet-500/20 transition-colors border border-violet-500/20">
            {isSidebarOpen ? <Cpu size={20} /> : <Menu size={20} />}
          </div>
          <div className="flex flex-col items-start">
            <h1 className="text-white font-bold tracking-tight text-lg leading-none">Cortex</h1>
            <span className="text-[10px] text-cortex-500 font-mono uppercase tracking-widest">Data Nexus v1.5</span>
          </div>
        </button>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2">
          {/* Screen Share Toggle */}
          <button 
            onClick={toggleScreenShare}
            className={`p-2 rounded-lg transition-all flex items-center gap-2 border ${
              isScreenSharing 
                ? 'bg-green-600 text-white border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)] animate-pulse' 
                : 'text-cortex-500 hover:text-white hover:bg-cortex-800 border-transparent'
            }`}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen for Guidance"}
          >
            {isScreenSharing ? (
              <>
                <MonitorX size={20} />
                <span className="text-xs font-bold hidden md:inline">ON AIR</span>
              </>
            ) : (
              <Monitor size={20} />
            )}
          </button>

          {/* Settings Button */}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-cortex-500 hover:text-white hover:bg-cortex-800 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings size={22} />
          </button>
        </div>
      </header>

      {/* Main Content Layout: Sidebar + (Split Panel OR Chat) */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Separator: Sidebar */}
        <div 
          className={`bg-cortex-900 border-r border-cortex-800 transition-all duration-300 ease-in-out absolute md:relative z-30 h-full ${
            isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 md:w-0 opacity-0 md:opacity-100 overflow-hidden'
          }`}
        >
          <Sidebar 
            onNewChat={handleNewChat} 
          />
        </div>

        {/* Mobile Overlay for Sidebar */}
        {isSidebarOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black/50 z-20 top-16"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Right Separator: Content Area (Chat or Split View) */}
        <div 
          ref={contentAreaRef}
          className="flex-1 flex min-w-0 h-full bg-[#0d1117] relative overflow-hidden"
        >
          
          {/* Left Split: Screen Share Preview (Only visible if sharing) */}
          {isScreenSharing && (
            <div 
              className="flex flex-col bg-black relative border-r border-cortex-800"
              style={{ width: `${100 - chatPanelWidth}%` }}
            >
               <div className="absolute top-4 left-4 z-10 bg-green-600/90 backdrop-blur px-3 py-1 rounded-full text-white text-xs font-bold flex items-center gap-2 shadow-lg border border-green-500/50">
                  <Monitor size={14} className="animate-pulse" /> LIVE SCREEN PREVIEW
               </div>
               <video 
                 ref={screenVideoRef} 
                 className="w-full h-full object-contain" 
                 autoPlay 
                 playsInline 
                 muted 
               />
            </div>
          )}

          {/* Drag Handle */}
          {isScreenSharing && (
            <div 
              className="w-1.5 bg-cortex-800 hover:bg-cortex-blue cursor-col-resize z-20 flex items-center justify-center transition-colors group"
              onMouseDown={(e) => { setIsDragging(true); e.preventDefault(); }}
            >
               <GripVertical size={12} className="text-cortex-600 group-hover:text-white" />
            </div>
          )}

          {/* Right Split: Chat Interface */}
          <div 
             className="flex flex-col h-full bg-[#0d1117] relative min-w-[200px]"
             style={{ width: isScreenSharing ? `${chatPanelWidth}%` : '100%' }}
          >
            {/* Messages */}
            <div className="flex-1 overflow-y-auto scroll-smooth">
              {messages.map((msg) => (
                <ChatMessage 
                  key={msg.id} 
                  message={msg} 
                  persona={personas[currentPersonaKey]} // Use dynamic persona
                />
              ))}
              {isLoading && messages[messages.length - 1].role === Role.USER && (
                <div className="w-full py-8 px-4">
                    <div className="max-w-4xl mx-auto flex gap-4">
                      <div 
                        className="w-8 h-8 rounded-sm flex items-center justify-center animate-pulse"
                        style={{ backgroundColor: `${personas[currentPersonaKey].color}20`, color: personas[currentPersonaKey].color }}
                      >
                          {React.createElement(personas[currentPersonaKey].icon, { size: 18 })}
                      </div>
                      <div className="flex flex-col justify-center gap-1">
                          <div className="flex items-center gap-2 text-cortex-500 text-sm font-mono">
                            <Loader2 size={12} className="animate-spin"/>
                            <span>Generating...</span>
                          </div>
                      </div>
                    </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[#0d1117]">
              <div className="max-w-4xl mx-auto relative">
                
                {/* Stop Button */}
                {isLoading && (
                  <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-20">
                    <button className="bg-cortex-800 hover:bg-cortex-700 text-gray-300 border border-cortex-700 px-4 py-1.5 rounded-full text-sm flex items-center gap-2 shadow-lg">
                        <StopCircle size={14} className="text-red-400" /> Stop
                    </button>
                  </div>
                )}

                {/* Attachment Preview */}
                {(attachment || isScreenSharing) && (
                  <div className="absolute -top-20 left-0 bg-cortex-800 border border-cortex-700 p-3 rounded-xl flex items-center gap-3 shadow-xl z-10 animate-in slide-in-from-bottom-2">
                      <div className="w-10 h-10 rounded-lg bg-black/50 flex items-center justify-center overflow-hidden border border-cortex-700 relative">
                        {isScreenSharing && !attachment ? (
                          <div className="w-full h-full flex items-center justify-center bg-green-900/20 text-green-400 animate-pulse">
                            <Monitor size={20} />
                          </div>
                        ) : attachment?.type === 'image' ? (
                          <img src={`data:${attachment?.mimeType};base64,${attachment?.data}`} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="text-cortex-blue" size={20} />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-200 max-w-[150px] truncate">
                          {isScreenSharing && !attachment ? 'Live Screen Context' : attachment?.fileName || 'Attachment'}
                        </span>
                        <span className="text-[10px] text-cortex-500 uppercase">
                          {isScreenSharing && !attachment ? 'AUTO-CAPTURE' : attachment?.mimeType.split('/')[1] || 'FILE'}
                        </span>
                      </div>
                      {/* Only show close button if it is a manual attachment */}
                      {attachment && (
                        <button onClick={() => setAttachment(null)} className="p-1 hover:bg-cortex-700 rounded-full text-gray-500 hover:text-white transition-colors">
                          <X size={14}/>
                        </button>
                      )}
                  </div>
                )}

                {/* Main Input Bar */}
                <div className={`bg-cortex-800 rounded-[28px] border shadow-2xl flex items-end p-2 relative z-10 transition-all focus-within:ring-1 focus-within:ring-cortex-700/50 ${isScreenSharing ? 'border-green-500/30' : 'border-cortex-700'}`}>
                    
                    {/* Hidden File Input for Chat Attachments */}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.docx,.xlsx,.py,.json,.md,.txt,.csv"
                      onChange={handleFileSelect}
                    />

                    {/* Left Controls: Plus Menu & Persona Switcher */}
                    <div className="flex items-center gap-1 shrink-0 pb-1 pl-1">
                      
                      {/* Plus / Link Menu Button */}
                      <div className="relative" ref={menuRef}>
                        <button 
                          onClick={() => setIsMenuOpen(!isMenuOpen)}
                          className={`p-3 rounded-full h-[42px] w-[42px] flex items-center justify-center shrink-0 transition-colors ${isMenuOpen ? 'bg-cortex-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-cortex-700/50'}`}
                          title="Add Assets"
                        >
                          <Plus size={20} />
                        </button>

                        {/* The Menu Popup */}
                        {isMenuOpen && (
                          <div className="absolute bottom-full left-0 mb-4 w-64 bg-[#1e232b] border border-cortex-700 rounded-2xl shadow-2xl overflow-hidden py-2 animate-in fade-in zoom-in-95 duration-100 origin-bottom-left z-50">
                            <button onClick={() => handleMenuOption('files')} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-cortex-700/50 transition-colors text-left group">
                              <div className="w-8 h-8 rounded-full bg-cortex-blue/10 text-cortex-blue flex items-center justify-center group-hover:bg-cortex-blue/20"><ImageIcon size={16} /></div>
                              <span className="text-sm text-gray-200">Add photos & files</span>
                            </button>
                            <button onClick={() => handleMenuOption('research')} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-cortex-700/50 transition-colors text-left group">
                              <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:bg-purple-500/20"><Globe size={16} /></div>
                              <span className="text-sm text-gray-200">Deep research</span>
                            </button>
                            <button onClick={() => handleMenuOption('thinking')} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-cortex-700/50 transition-colors text-left group">
                              <div className="w-8 h-8 rounded-full bg-yellow-500/10 text-yellow-400 flex items-center justify-center group-hover:bg-yellow-500/20"><Brain size={16} /></div>
                              <span className="text-sm text-gray-200">Thinking</span>
                            </button>
                            <button onClick={() => handleMenuOption('study')} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-cortex-700/50 transition-colors text-left group">
                              <div className="w-8 h-8 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center group-hover:bg-green-500/20"><GraduationCap size={16} /></div>
                              <span className="text-sm text-gray-200">Study & learn</span>
                            </button>
                            <button onClick={() => handleMenuOption('web')} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-cortex-700/50 transition-colors text-left group">
                              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:bg-blue-500/20"><Search size={16} /></div>
                              <span className="text-sm text-gray-200">Web search</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Persona Selector Button */}
                      <div className="relative" ref={personaMenuRef}>
                        <button
                          onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
                          className={`p-3 rounded-full h-[42px] w-[42px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                            isPersonaMenuOpen 
                              ? 'bg-cortex-700 text-white shadow-md' 
                              : 'text-gray-400 hover:text-white hover:bg-cortex-700/50'
                          }`}
                          style={{ color: isPersonaMenuOpen ? 'white' : personas[currentPersonaKey].color }}
                          title={`Current Role: ${personas[currentPersonaKey].name}`}
                        >
                          {React.createElement(personas[currentPersonaKey].icon, { size: 20 })}
                        </button>
                        
                        {/* Persona Dropdown Menu */}
                        {isPersonaMenuOpen && (
                          <div className="absolute bottom-full left-0 mb-4 w-72 bg-[#1e232b] border border-cortex-700 rounded-2xl shadow-2xl flex flex-col max-h-[60vh] animate-in fade-in zoom-in-95 duration-100 origin-bottom-left z-50 overflow-hidden">
                              <div className="overflow-y-auto scrollbar-thin py-2">
                                
                                {/* Unified Intelligence */}
                                <div className="px-4 py-2 text-[10px] font-bold text-cortex-500 uppercase tracking-wider sticky top-0 bg-[#1e232b]/95 backdrop-blur-sm z-10">
                                  Unified Intelligence
                                </div>
                                {renderPersonaMenuItem(personas[PersonaKey.ORCHESTRATOR])}

                                {/* Neural Models */}
                                <div className="px-4 py-2 mt-2 text-[10px] font-bold text-cortex-500 uppercase tracking-wider sticky top-0 bg-[#1e232b]/95 backdrop-blur-sm z-10">
                                  Neural Models
                                </div>
                                {renderPersonaMenuItem(personas[PersonaKey.BIBLIOTHECA])}

                                {/* Specialized Roles */}
                                <div className="px-4 py-2 mt-2 text-[10px] font-bold text-cortex-500 uppercase tracking-wider sticky top-0 bg-[#1e232b]/95 backdrop-blur-sm z-10">
                                  Specialized Roles
                                </div>
                                {(Object.values(personas) as Persona[])
                                    .filter(p => p.key !== PersonaKey.ORCHESTRATOR && p.key !== PersonaKey.BIBLIOTHECA)
                                    .map(renderPersonaMenuItem)}
                              </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Text Area */}
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={isScreenSharing ? "Ask about your screen..." : `Ask ${personas[currentPersonaKey].name}...`}
                      className="flex-1 bg-transparent border-0 focus:ring-0 text-gray-200 placeholder-gray-500 px-2 py-3 min-h-[46px] max-h-[200px] resize-none leading-relaxed scrollbar-hide text-sm"
                      rows={1}
                      onInput={(e: any) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.value ? `${e.target.scrollHeight}px` : 'auto';
                      }}
                    />

                    {/* Right Action Buttons */}
                    <div className="flex items-center gap-1 pb-1 pr-1">
                      <button 
                        onClick={toggleRecording}
                        className={`p-3 rounded-full transition-all duration-300 ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-red-glow' : 'text-gray-400 hover:text-white hover:bg-cortex-700/50'}`}
                        title="Voice Mode"
                      >
                          {isTranscribing ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
                      </button>

                      <button
                        onClick={handleSubmit}
                        disabled={(!input.trim() && !attachment && !isScreenSharing) || isLoading}
                        className={`p-3 rounded-full transition-all duration-300 ${
                          (input.trim() || attachment || isScreenSharing) && !isLoading
                            ? 'bg-white text-black hover:bg-gray-200 shadow-glow'
                            : 'bg-cortex-700 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <Send size={20} />
                      </button>
                    </div>

                </div>
                
                <div className="text-center mt-3">
                  <p className="text-[10px] text-cortex-500">
                    Cortex remembers your sessions and knowledge base locally.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;