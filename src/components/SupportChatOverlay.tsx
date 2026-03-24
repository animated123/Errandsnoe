import React, { useState, useEffect } from 'react';
import { MessageCircle, X, MessageSquare, ArrowRight } from 'lucide-react';
import { User } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import SupportChatView from './SupportChatView';

interface SupportChatOverlayProps {
  user: User;
}

export default function SupportChatOverlay({ user }: SupportChatOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      const unsub = firebaseService.subscribeToSupportChat(user.id, (data) => {
        if (data?.unreadByUser) {
          // Count unread messages (simplified)
          setUnreadCount(1);
        } else {
          setUnreadCount(0);
        }
      });
      return () => unsub();
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 pointer-events-none">
      {isOpen && (
        <div className="w-[380px] h-[500px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-500 pointer-events-auto">
          <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">Live Support</h3>
                <p className="text-[8px] font-bold text-white/60 uppercase tracking-widest">We're online</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <SupportChatView user={user} />
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all active:scale-90 pointer-events-auto relative ${isOpen ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white shadow-indigo-200'}`}
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
        {!isOpen && unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-4 border-white animate-bounce">
            {unreadCount}
          </div>
        )}
      </button>
    </div>
  );
}
