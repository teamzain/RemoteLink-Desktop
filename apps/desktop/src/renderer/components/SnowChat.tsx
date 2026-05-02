import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Video, 
  Phone, 
  MoreHorizontal, 
  Paperclip, 
  Smile, 
  CornerDownLeft,
  ChevronDown,
  FileText,
  Shield,
  X,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';

export const SnowChat: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    conversations, 
    messages, 
    activeChatId, 
    setActiveChat, 
    fetchConversations, 
    createConversation, 
    sendMessage, 
    connectWebSocket, 
    disconnectWebSocket 
  } = useChatStore();

  const [showAddContact, setShowAddContact] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    connectWebSocket();
    
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    return () => disconnectWebSocket();
  }, []);

  const activeMessages = activeChatId ? (messages[activeChatId] || []) : [];
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const groups = conversations.filter(c => c.isGroup);
  const directChats = conversations.filter(c => !c.isGroup);

  const activeConversation = conversations.find(c => c.id === activeChatId);

  const handleSend = () => {
    if (!inputText.trim() || !activeChatId) return;
    sendMessage(activeChatId, inputText);
    setInputText('');
  };

  const handleCreateChat = async () => {
    if (!inviteEmail) return;
    setIsInviting(true);
    setInviteError(null);
    const success = await createConversation(inviteEmail);
    if (success) {
      setShowAddContact(false);
      setInviteEmail('');
    } else {
      setInviteError('User not found. They must have a Remote 365 account.');
    }
    setIsInviting(false);
  };

  // Helper to get the other participant in a 1-on-1 chat
  const getOtherParticipant = (conv: any) => {
    if (!conv || !conv.participants) return null;
    const other = conv.participants.find((p: any) => p.userId !== user?.id);
    console.log('[SnowChat] getOtherParticipant:', {
      convId: conv.id,
      myId: user?.id,
      participants: conv.participants.map((p: any) => p.userId),
      foundOther: other?.userId
    });
    if (other) return other.user;
    return conv.participants[0]?.user;
  };

  const activeParticipant = activeConversation && !activeConversation.isGroup ? getOtherParticipant(activeConversation) : null;

  return (
    <div className="flex h-full w-full bg-white dark:bg-[#080808] font-sans">
      {/* Left Sidebar */}
      <div className="w-[320px] h-full border-r border-gray-100 dark:border-white/5 flex flex-col flex-shrink-0 bg-white dark:bg-[#0A0A0A]">
        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between">
          <h1 className="text-[28px] font-medium text-[#111111] dark:text-[#F5F5F5] tracking-tight">Chats</h1>
          <button 
            onClick={() => setShowAddContact(true)}
            className="w-8 h-8 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center text-gray-600 dark:text-[#A0A0A0] hover:bg-gray-200 transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full bg-[#F0F2F5] dark:bg-[#141414] text-[#111111] dark:text-[#F5F5F5] placeholder:text-gray-400 rounded-xl py-2 pl-9 pr-4 text-[13px] outline-none border border-transparent focus:bg-white dark:focus:bg-[#1A1A1A] focus:border-gray-200 dark:focus:border-white/10 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
          {/* Direct Messages */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-[12px] font-bold text-gray-400 tracking-wider uppercase">Direct messages</h3>
            </div>
            <div className="space-y-0.5">
              {directChats.length === 0 ? (
                <div key="no-direct-chats" className="px-2 py-3 text-[13px] text-gray-500 text-center">No direct messages yet</div>
              ) : (
                directChats.map((chat, idx) => {
                  const otherUser = getOtherParticipant(chat);
                  const lastMessage = chat.messages?.[0]?.content || 'Start a conversation';
                  return (
                    <button
                      key={chat.id || `direct-${idx}`}
                      onClick={() => {
                        console.log('[SnowChat] Clicking conversation:', chat.id);
                        setActiveChat(chat.id);
                      }}
                      className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors ${
                        activeChatId === chat.id 
                          ? 'bg-[#F0F2F5] dark:bg-[#1C1C1C]' 
                          : 'hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="relative">
                        {otherUser?.avatar ? (
                          <img src={otherUser.avatar} alt={otherUser.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#CDE6E8] dark:bg-[#1A3A3D] text-[#1A3A3D] dark:text-[#8EE6EE] flex items-center justify-center font-medium">
                            {otherUser?.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0A0A0A] rounded-full"></div>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-medium text-[#111111] dark:text-[#F5F5F5] text-[14px] truncate">{otherUser?.name || otherUser?.email || 'Unknown Contact'}</span>
                        </div>
                        <p className="text-[12px] text-gray-500 truncate">{lastMessage}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Groups */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-[12px] font-bold text-gray-400 tracking-wider uppercase">Groups</h3>
            </div>
            <div className="space-y-0.5">
              {groups.length === 0 ? (
                <div key="no-groups" className="px-2 py-3 text-[13px] text-gray-500 text-center">No groups yet</div>
              ) : (
                groups.map((chat, idx) => {
                  const lastMessage = chat.messages?.[0]?.content || 'Start a conversation';
                  return (
                    <button
                      key={chat.id || `group-${idx}`}
                      onClick={() => setActiveChat(chat.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors ${
                        activeChatId === chat.id 
                          ? 'bg-[#F0F2F5] dark:bg-[#1C1C1C]' 
                          : 'hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#F0F2F5] dark:bg-[#141414] text-gray-500 flex items-center justify-center shrink-0">
                        <span className="font-medium text-[14px]">#</span>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-medium text-[#111111] dark:text-[#F5F5F5] text-[14px] truncate">{chat.name || 'Group Chat'}</span>
                        </div>
                        <p className="text-[12px] text-gray-500 truncate">{lastMessage}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      {activeChatId ? (
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#080808]">
          {/* Header */}
          <div className="h-[88px] px-8 flex items-center justify-between border-b border-gray-100 dark:border-white/5 shrink-0">
            <div className="flex items-center gap-4">
              <div className="relative">
                {activeParticipant?.avatar ? (
                  <img src={activeParticipant.avatar} alt={activeParticipant.name} className="w-[52px] h-[52px] rounded-full object-cover" />
                ) : (
                  <div className="w-[52px] h-[52px] bg-[#CDE6E8] dark:bg-[#1A3A3D] text-[#1A3A3D] dark:text-[#8EE6EE] rounded-full flex items-center justify-center text-xl font-medium">
                    {activeParticipant?.name?.charAt(0) || activeConversation?.name?.charAt(0) || '#'}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-[20px] font-medium text-[#111111] dark:text-[#F5F5F5]">
                  {activeParticipant?.name || activeParticipant?.email || activeConversation?.name || 'Chat'}
                </h2>
                <p className="text-[14px] text-gray-500 dark:text-[#A0A0A0]">
                  {activeParticipant?.email || 'Group members'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="w-10 h-10 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-[#A0A0A0] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <Video size={18} />
              </button>
              <button className="w-10 h-10 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-[#A0A0A0] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <Phone size={18} />
              </button>
              <button className="px-5 py-2.5 bg-[#1C202B] text-white text-[13px] font-medium rounded-full hover:bg-[#2A2F3D] transition-colors ml-2">
                View profile
              </button>
              <button className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-[#A0A0A0] hover:bg-gray-200 dark:hover:bg-white/20 transition-colors ml-1">
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {activeMessages.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500">
                No messages yet. Send a message to start the conversation!
              </div>
            )}
            
            {activeMessages.map(msg => {
              const isMine = msg.senderId === user?.id;
              
              if (isMine) {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[500px]">
                      <div className="flex justify-end gap-3 mb-1">
                        <span className="text-[12px] text-gray-400">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="font-semibold text-[#111111] dark:text-[#F5F5F5] text-[14px]">You</span>
                      </div>
                      <div className="bg-[#EAF3FA] dark:bg-[#162740] text-[#111111] dark:text-[#F5F5F5] px-5 py-3 rounded-2xl rounded-tr-sm text-[14px] leading-relaxed shadow-sm">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex gap-4 max-w-[600px]">
                  <div className="w-8 h-8 rounded-full bg-[#CDE6E8] dark:bg-[#1A3A3D] text-[#1A3A3D] dark:text-[#8EE6EE] flex items-center justify-center text-sm font-medium shrink-0 relative mt-1">
                    {msg.sender?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-[#111111] dark:text-[#F5F5F5] text-[14px]">
                        {msg.sender?.name || 'Unknown User'}
                      </span>
                      <span className="text-[12px] text-gray-400">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="bg-[#F0F2F5] dark:bg-[#141414] text-[#111111] dark:text-[#F5F5F5] px-5 py-3 rounded-2xl rounded-tl-sm text-[14px] leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 shrink-0 border-t border-transparent dark:border-white/5">
            <div className="flex items-center gap-3 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900 transition-all">
              <button className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-[#F5F5F5] transition-colors shrink-0">
                <Paperclip size={20} />
              </button>
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                placeholder="Type here..." 
                className="flex-1 bg-transparent text-[14px] text-[#111111] dark:text-[#F5F5F5] placeholder:text-gray-400 outline-none"
              />
              <button className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-[#F5F5F5] transition-colors shrink-0">
                <Smile size={20} />
              </button>
              <button 
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="w-10 h-10 bg-[#1C202B] disabled:opacity-50 text-white rounded-xl flex items-center justify-center hover:bg-[#2A2F3D] transition-colors shrink-0"
              >
                <CornerDownLeft size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#080808] text-gray-400">
          <Shield size={48} className="mb-4 text-gray-200 dark:text-white/10" />
          <h3 className="text-xl font-medium text-gray-600 dark:text-gray-300">Your messages are private</h3>
          <p className="mt-2 text-sm text-gray-500">Select a contact to start chatting</p>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1C1C1C] rounded-[20px] w-[540px] shadow-2xl p-8 font-sans relative">
            <button 
              onClick={() => setShowAddContact(false)}
              className="absolute top-8 right-8 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <X size={24} strokeWidth={1.5} />
            </button>
            
            <h3 className="text-[22px] font-medium text-[#111111] dark:text-[#F5F5F5] mb-4">Add contact to your list</h3>
            
            <p className="text-[14px] text-gray-500 dark:text-[#A0A0A0] mb-8 leading-relaxed pr-8">
              Once the contact accepts your invitation, you can easily start a remote session and exchange messages.
            </p>

            <div className="relative mb-8">
              <input 
                type="email" 
                id="contact-email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="block px-4 py-3.5 w-full text-[14px] text-gray-900 dark:text-white bg-transparent rounded-xl border border-blue-600 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer" 
                placeholder=" " 
              />
              <label 
                htmlFor="contact-email" 
                className="absolute text-[13px] text-blue-600 bg-white dark:bg-[#1C1C1C] px-1 duration-300 transform -translate-y-4 scale-[0.85] top-2 z-10 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-[0.85] peer-focus:-translate-y-4"
              >
                Email
              </label>
            </div>

            {inviteError && (
              <p className="text-[12px] text-red-500 font-medium mb-6 animate-in fade-in slide-in-from-top-1">
                {inviteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowAddContact(false)}
                className="text-[14px] font-medium text-[#111111] dark:text-[#F5F5F5] hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-4 py-2.5"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateChat}
                disabled={!inviteEmail || isInviting}
                className={`px-6 py-2.5 rounded-lg text-[14px] font-medium transition-colors flex items-center gap-2 ${
                  inviteEmail && !isInviting
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-[#F0F2F5] dark:bg-[#2A2A2A] text-gray-400 dark:text-[#666666] pointer-events-none'
                }`}
              >
                {isInviting ? <RefreshCw size={16} className="animate-spin" /> : null}
                {isInviting ? 'Sending...' : 'Send invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
