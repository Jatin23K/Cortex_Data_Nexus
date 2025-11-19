import React, { useState } from 'react';
import { Message, Role, Persona } from '../types';
import { Bot, User, AlertCircle, Volume2, Loader2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { generateSpeech } from '../services/geminiService';

interface ChatMessageProps {
  message: Message;
  persona: Persona;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, persona }) => {
  const isUser = message.role === Role.USER;
  const isError = message.isError;
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSpeak = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      const audioBuffer = await generateSpeech(message.text);
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createBufferSource();
      source.buffer = await audioContext.decodeAudioData(audioBuffer);
      source.connect(audioContext.destination);
      source.onended = () => setIsPlaying(false);
      source.start(0);
    } catch (error) {
      console.error("TTS Playback failed", error);
      setIsPlaying(false);
    }
  };

  return (
    <div className={`w-full py-8 px-4 md:px-8 border-b border-cortex-800 ${isUser ? 'bg-transparent' : 'bg-[#0f1117]/50'}`}>
      <div className="max-w-4xl mx-auto flex gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div 
            className={`w-8 h-8 rounded-sm flex items-center justify-center ${isUser ? 'bg-cortex-700' : ''}`}
            style={{ 
              backgroundColor: isUser ? undefined : `${persona.color}20`, 
              color: isUser ? undefined : persona.color 
            }}
          >
            {isUser ? <User size={18} className="text-gray-300" /> : <persona.icon size={18} />}
          </div>
          
          {!isUser && !isError && (
             <button 
               onClick={handleSpeak} 
               className={`text-cortex-500 hover:text-cortex-blue transition-colors ${isPlaying ? 'text-cortex-blue animate-pulse' : ''}`}
               title="Read Aloud"
             >
               {isPlaying ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
             </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-white">
              {isUser ? 'You' : persona.name}
            </span>
            {!isUser && (
              <span 
                className="text-xs px-2 py-0.5 rounded-full bg-cortex-800 border border-cortex-700"
                style={{ color: persona.color, borderColor: `${persona.color}30` }}
              >
                {persona.title}
              </span>
            )}
          </div>

          {/* Attachment Preview in Chat */}
          {message.attachment && (
             <div className="mb-4 mt-2">
               <div className="max-w-sm rounded-lg overflow-hidden border border-cortex-700 bg-black">
                 <img 
                   src={`data:${message.attachment.mimeType};base64,${message.attachment.data}`} 
                   alt="User attachment" 
                   className="w-full h-auto"
                 />
               </div>
             </div>
          )}

          {isError ? (
            <div className="text-red-400 flex items-center gap-2 mt-2 bg-red-900/20 p-3 rounded border border-red-900/50">
              <AlertCircle size={16} />
              <span>{message.text}</span>
            </div>
          ) : (
            <div className="text-gray-300 leading-relaxed">
              {isUser ? (
                <div className="whitespace-pre-wrap font-sans text-[15px]">{message.text}</div>
              ) : (
                <MarkdownRenderer content={message.text} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;