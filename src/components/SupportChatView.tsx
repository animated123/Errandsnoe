import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { User } from '../../types';
import { firebaseService } from '../../services/firebaseService';

interface SupportChatViewProps {
  user: User;
  targetUserId?: string;
  isAdmin?: boolean;
}

const SupportChatView: React.FC<SupportChatViewProps> = ({ user, targetUserId, isAdmin = false }) => {
  const [chat, setChat] = useState<any>(null);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatUserId = targetUserId || user.id;

  useEffect(() => {
    const unsub = firebaseService.subscribeToSupportChat(chatUserId, (data) => {
      setChat(data);
      if (isAdmin ? data?.unreadByAdmin : data?.unreadByUser) {
        firebaseService.markSupportChatAsRead(chatUserId, isAdmin);
      }
    });
    return () => unsub();
  }, [chatUserId, isAdmin]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat?.messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const msg = text;
    setText('');
    await firebaseService.sendSupportMessage(chatUserId, user.name, msg, isAdmin);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
        {!chat || !chat.messages || chat.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30">
            <MessageSquare size={48} strokeWidth={1} />
            <p className="text-sm font-black uppercase mt-4">No messages yet</p>
          </div>
        ) : (
          chat.messages.map((m: any, i: number) => (
            <div key={m.id || `msg-${i}`} className={`flex flex-col ${m.senderId === (isAdmin ? 'admin' : user.id) ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${m.senderId === (isAdmin ? 'admin' : user.id) ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-100' : 'bg-white text-slate-900 border border-slate-100 rounded-tl-none shadow-sm'}`}>
                {m.text}
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase mt-1.5 px-1">{m.senderName} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSend} className="p-4 bg-white border-t flex gap-3">
        <input 
          type="text" value={text} onChange={e => setText(e.target.value)} 
          placeholder="Type your message..." 
          className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <button type="submit" className="p-3 bg-indigo-600 text-white rounded-2xl active:scale-90 transition-all shadow-lg shadow-indigo-100">
          <ArrowRight size={20} />
        </button>
      </form>
    </div>
  );
};

export default SupportChatView;
