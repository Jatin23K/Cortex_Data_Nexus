import React from 'react';
import { MessageSquarePlus, History } from 'lucide-react';

interface SidebarProps {
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onNewChat }) => {
  return (
    <div className="h-full flex flex-col bg-cortex-900 text-gray-300 border-r border-cortex-800">
      <div className="p-4 space-y-4">
        <button 
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white text-black hover:bg-gray-200 rounded-lg transition-colors font-medium shadow-sm group"
        >
           <div className="text-cortex-900 group-hover:scale-110 transition-transform">
             <MessageSquarePlus size={18} />
           </div>
           <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
        {/* History Section (Placeholder) */}
        <div className="mt-4">
           <div className="px-4 py-2 text-xs font-bold text-cortex-500 uppercase tracking-wider flex items-center gap-2">
              <History size={12} /> Recent Activity
           </div>
           <div className="px-4 py-2 text-sm text-cortex-600 italic text-[11px]">
              Session history is stored locally in your browser.
           </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;