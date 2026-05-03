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
  RefreshCw,
  Trash2,
  AlertTriangle,
  Ban,
  UserMinus,
  Unlock,
  Users,
  UserPlus,
  Hash,
  Copy,
  ExternalLink,
  CheckCircle2,
  Monitor
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import api from '../lib/api';

const SESSION_INVITE_PREFIX = '[[REMOTE365_SESSION_INVITE]]';

const parseSessionInviteContent = (content: string) => {
  if (!content?.startsWith(SESSION_INVITE_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(SESSION_INVITE_PREFIX.length));
  } catch {
    return null;
  }
};

export const SnowChat: React.FC<{
  setCurrentView?: (view: any) => void;
  localAuthKey?: string | null;
  devicePassword?: string;
  onJoinSessionInvite?: (code: string, password?: string) => void;
  onJoinMeeting?: (meetingId: string) => void;
}> = ({ setCurrentView, localAuthKey, devicePassword, onJoinSessionInvite, onJoinMeeting }) => {
  const { user } = useAuthStore();
  const { 
    conversations, 
    messages, 
    activeChatId, 
    setActiveChat, 
    fetchConversations, 
    createConversation, 
    createGroup,
    addGroupMembers,
    sendMessage, 
    renameConversation,
    deleteConversation,
    unfriendConversation,
    blockConversation,
    unblockConversation,
    acceptInvite,
    rejectInvite,
    connectWebSocket, 
    disconnectWebSocket,
    isLoading
  } = useChatStore();

  const [showAddContact, setShowAddContact] = useState(false);
  const [addMode, setAddMode] = useState<'contact' | 'group'>('contact');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupEmails, setGroupEmails] = useState('');
  const [memberEmails, setMemberEmails] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [sessionPassword, setSessionPassword] = useState('');
  const [sessionType, setSessionType] = useState<'REMOTE_CONTROL' | 'VIDEO_MEETING'>('REMOTE_CONTROL');
  const [sessionInviteEmail, setSessionInviteEmail] = useState('');
  const [sessionName, setSessionName] = useState('Remote support session');
  const [sessionInviteStatus, setSessionInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sessionInviteMessage, setSessionInviteMessage] = useState('');
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
  const isInviteRequester = activeConversation?.requestedById
    ? activeConversation.requestedById === user?.id
    : activeConversation?.participants?.[0]?.userId === user?.id;
  const isBlockedByMe = activeConversation?.status === 'BLOCKED' && activeConversation.blockedById === user?.id;

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

  const parseEmails = (value: string) => {
    return value
      .split(/[\s,;]+/)
      .map(email => email.trim().toLowerCase())
      .filter(Boolean);
  };

  const handleCreateGroup = async () => {
    const emails = parseEmails(groupEmails);
    if (!groupName.trim() || emails.length === 0) return;
    setIsInviting(true);
    setInviteError(null);
    const success = await createGroup(groupName.trim(), emails);
    if (success) {
      setShowAddContact(false);
      setGroupName('');
      setGroupEmails('');
      setAddMode('contact');
    } else {
      setInviteError('Could not create group. Check that every email has a Remote 365 account.');
    }
    setIsInviting(false);
  };

  const handleAddMembers = async () => {
    const emails = parseEmails(memberEmails);
    if (!activeChatId || emails.length === 0) return;
    setIsInviting(true);
    setInviteError(null);
    const success = await addGroupMembers(activeChatId, emails);
    if (success) {
      setShowAddMembersModal(false);
      setMemberEmails('');
    } else {
      setInviteError('Could not add members. Check that every email has a Remote 365 account.');
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

  const getChatName = (chat: any) => {
    if (!chat) return 'Chat';
    
    // 1. Check for nickname in current user's participant record
    const myParticipant = chat.participants?.find((p: any) => p.userId === user?.id);
    if (myParticipant?.nickname) {
      console.log(`[SnowChat] Using nickname for ${chat.id}:`, myParticipant.nickname);
      return myParticipant.nickname;
    }

    // 2. Fallback to conversation name
    if (chat.name) return chat.name;

    // 3. Fallback to other participant's name
    const other = getOtherParticipant(chat);
    if (!other) {
      console.warn(`[SnowChat] No other participant found for ${chat.id}. Participants:`, chat.participants);
    }
    return other?.name || other?.email || 'Unknown Contact';
  };

  const activeParticipant = activeConversation && !activeConversation.isGroup ? getOtherParticipant(activeConversation) : null;
  const activeGroupMembers = activeConversation?.isGroup ? (activeConversation.participants || []) : [];
  const sessionCodeGenerated = (localAuthKey || '').replace(/\s/g, '');
  const sessionLink = `remotelink://join?code=${encodeURIComponent(sessionCodeGenerated)}&password=${encodeURIComponent(devicePassword || '')}`;

  const handleOpenSessionModal = () => {
    setSessionInviteEmail(activeConversation?.isGroup ? '' : (activeParticipant?.email || ''));
    setSessionName(activeConversation?.isGroup ? `${getChatName(activeConversation)} support session` : 'Remote support session');
    setSessionInviteStatus('idle');
    setSessionInviteMessage('');
    setShowSessionModal(true);
  };

  const handleSendSessionInvite = async () => {
    if (!activeChatId || !sessionCodeGenerated) {
      setSessionInviteStatus('error');
      setSessionInviteMessage('This device is still getting its RemoteLink ID.');
      return;
    }

    setSessionInviteStatus('sending');
    setSessionInviteMessage('');
    try {
      await api.post('/api/chat/session-invites', {
        conversationId: activeChatId,
        email: sessionInviteEmail.trim() || undefined,
        sessionName,
        sessionCode: sessionCodeGenerated,
        sessionPassword: sessionType === 'VIDEO_MEETING' ? '' : devicePassword,
        sessionLink,
        type: sessionType
      });
      setSessionInviteStatus('sent');
      setSessionInviteMessage('Session invite sent in chat and by email.');
    } catch (err: any) {
      setSessionInviteStatus('error');
      setSessionInviteMessage(err.response?.data?.error || err.message || 'Could not send session invite.');
    }
  };

  if (isLoading && conversations.length === 0) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-white dark:bg-[#080808] font-sans">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 animate-spin text-[#00193F]" />
          <p className="text-sm font-medium text-gray-500 animate-pulse">Initializing Remote 365 Chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-white dark:bg-[#080808] font-sans">
      {/* Left Sidebar */}
      <div className="w-[320px] h-full border-r border-gray-100 dark:border-white/5 flex flex-col flex-shrink-0 bg-white dark:bg-[#0A0A0A]">
        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between">
          <h1 className="text-[28px] font-medium text-[#111111] dark:text-[#F5F5F5] tracking-tight">Chats</h1>
          <button 
            onClick={() => {
              setAddMode('contact');
              setInviteError(null);
              setShowAddContact(true);
            }}
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
                  const lastInvite = parseSessionInviteContent(chat.messages?.[0]?.content || '');
                  const lastMessage = lastInvite ? 'Remote session invite' : (chat.messages?.[0]?.content || 'Start a conversation');
                  return (
                    <button
                      key={chat.id || `direct-${idx}`}
                      onClick={() => {
                        console.log('[SnowChat] Clicking conversation:', chat.id, 'Full object:', chat);
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
                          <img src={otherUser.avatar} alt={getChatName(chat)} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#CDE6E8] dark:bg-[#1A3A3D] text-[#1A3A3D] dark:text-[#8EE6EE] flex items-center justify-center font-medium">
                            {getChatName(chat).charAt(0)}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0A0A0A] rounded-full"></div>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-medium text-[#111111] dark:text-[#F5F5F5] text-[14px] truncate">{getChatName(chat)}</span>
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
                  const lastInvite = parseSessionInviteContent(chat.messages?.[0]?.content || '');
                  const lastMessage = lastInvite ? 'Remote session invite' : (chat.messages?.[0]?.content || 'Start a conversation');
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
                {activeConversation?.isGroup ? (
                  <div className="w-[52px] h-[52px] bg-[#F0F2F5] dark:bg-[#141414] text-gray-600 dark:text-[#A0A0A0] rounded-full flex items-center justify-center">
                    <Users size={24} />
                  </div>
                ) : activeParticipant?.avatar ? (
                  <img src={activeParticipant.avatar} alt={getChatName(activeConversation)} className="w-[52px] h-[52px] rounded-full object-cover" />
                ) : (
                  <div className="w-[52px] h-[52px] bg-[#CDE6E8] dark:bg-[#1A3A3D] text-[#1A3A3D] dark:text-[#8EE6EE] rounded-full flex items-center justify-center text-xl font-medium">
                    {getChatName(activeConversation).charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-[20px] font-medium text-[#111111] dark:text-[#F5F5F5]">
                  {getChatName(activeConversation)}
                </h2>
                <p className="text-[14px] text-gray-500 dark:text-[#A0A0A0]">
                  {activeConversation?.isGroup
                    ? `${activeGroupMembers.length} member${activeGroupMembers.length === 1 ? '' : 's'}`
                    : activeParticipant?.email || 'Direct Message'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {activeConversation?.status === 'ACCEPTED' && (
                <button
                  onClick={handleOpenSessionModal}
                  className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                  title="Start remote session"
                >
                  <Video size={18} />
                </button>
              )}
              <button 
                onClick={() => activeConversation?.isGroup ? setShowAddMembersModal(true) : setShowProfileModal(true)}
                className="px-5 py-2.5 bg-[#1C202B] text-white text-[13px] font-medium rounded-full hover:bg-[#2A2F3D] transition-colors ml-2"
              >
                {activeConversation?.isGroup ? 'Add members' : 'View profile'}
              </button>
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowOptionsModal(!showOptionsModal);
                    setNewName(activeConversation?.name || activeParticipant?.name || '');
                  }}
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-600 dark:text-[#A0A0A0] hover:bg-gray-200 dark:hover:bg-white/20 transition-colors ml-1"
                >
                  <MoreHorizontal size={18} />
                </button>
                
                {showOptionsModal && (
                  <div className="absolute right-0 top-12 w-48 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/5 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <button 
                      onClick={() => { setIsRenaming(true); setShowOptionsModal(false); }}
                      className="w-full text-left px-4 py-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      Rename Conversation
                    </button>
                    {activeConversation?.isGroup && (
                      <button
                        onClick={() => {
                          setInviteError(null);
                          setShowAddMembersModal(true);
                          setShowOptionsModal(false);
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2"
                      >
                        <UserPlus size={14} />
                        Add Members
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setShowDeleteModal(true);
                        setShowOptionsModal(false);
                      }}
                      className="w-full text-left px-4 py-2 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Delete Chat
                    </button>
                    {!activeConversation?.isGroup && activeConversation?.status === 'ACCEPTED' && (
                      <button
                        onClick={() => {
                          unfriendConversation(activeChatId!);
                          setShowOptionsModal(false);
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 flex items-center gap-2"
                      >
                        <UserMinus size={14} />
                        Unfriend
                      </button>
                    )}
                    {!activeConversation?.isGroup && activeConversation?.status === 'BLOCKED' && isBlockedByMe ? (
                      <button
                        onClick={() => {
                          unblockConversation(activeChatId!);
                          setShowOptionsModal(false);
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 flex items-center gap-2"
                      >
                        <Unlock size={14} />
                        Unblock
                      </button>
                    ) : !activeConversation?.isGroup && activeConversation?.status !== 'BLOCKED' ? (
                      <button
                        onClick={() => {
                          blockConversation(activeChatId!);
                          setShowOptionsModal(false);
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2"
                      >
                        <Ban size={14} />
                        Block
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 bg-white dark:bg-[#080808]">
            {activeConversation?.status === 'BLOCKED' ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
                  <Ban size={40} />
                </div>
                <h3 className="text-[24px] font-bold text-[#111111] dark:text-[#F5F5F5] mb-2">
                  {isBlockedByMe ? 'Contact Blocked' : 'Chat Unavailable'}
                </h3>
                <p className="text-[15px] text-gray-500 dark:text-[#A0A0A0] mb-8 leading-relaxed">
                  {isBlockedByMe
                    ? "You blocked this contact. They can't send you messages or send a new request."
                    : "This chat is no longer available for messaging."}
                </p>
                {isBlockedByMe && (
                  <button
                    onClick={() => unblockConversation(activeChatId!)}
                    className="px-6 py-3 bg-[#1C202B] text-white text-[14px] font-bold rounded-2xl hover:bg-[#2A2F3D] transition-all shadow-xl shadow-black/10 flex items-center gap-2"
                  >
                    <Unlock size={16} />
                    Unblock Contact
                  </button>
                )}
              </div>
            ) : activeConversation?.status === 'PENDING' ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-full flex items-center justify-center mb-6">
                  <Plus size={40} />
                </div>
                <h3 className="text-[24px] font-bold text-[#111111] dark:text-[#F5F5F5] mb-2">Pending Invitation</h3>
                <p className="text-[15px] text-gray-500 dark:text-[#A0A0A0] mb-8 leading-relaxed">
                  {isInviteRequester 
                    ? "Waiting for the other person to accept your chat request. You can't send messages until they accept."
                    : "This person wants to chat with you. Accept the invitation to start exchanging messages."
                  }
                </p>
                
                {!isInviteRequester && (
                  <div className="flex gap-4 w-full">
                    <button 
                      onClick={() => acceptInvite(activeChatId!)}
                      className="flex-1 py-4 bg-[#1C202B] text-white text-[14px] font-bold rounded-2xl hover:bg-[#2A2F3D] transition-all shadow-xl shadow-black/10"
                    >
                      Accept Chat
                    </button>
                    <button 
                      onClick={() => rejectInvite(activeChatId!)}
                      className="flex-1 py-4 bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-white text-[14px] font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                    >
                      Ignore
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {activeMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 text-gray-400 rounded-full flex items-center justify-center mb-4">
                      <FileText size={32} />
                    </div>
                    <h3 className="text-[18px] font-medium text-gray-900 dark:text-gray-100 mb-1">No messages yet</h3>
                    <p className="text-[14px] text-gray-500 dark:text-gray-400">Send a message to start the conversation</p>
                  </div>
                ) : (
                  activeMessages.map((msg, idx) => {
                    const isMe = msg.senderId === user?.id;
                    const sender = msg.sender;
                    const sessionInvite = parseSessionInviteContent(msg.content);
                    
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className="flex-shrink-0 mt-1">
                            {sender?.avatar ? (
                              <img src={sender.avatar} alt={sender.name} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-[#A0A0A0] rounded-full flex items-center justify-center text-[12px] font-medium">
                                {sender?.name?.charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {sessionInvite ? (
                              <div className="w-[320px] rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-white dark:bg-[#111827] shadow-sm overflow-hidden">
                                <div className="p-4 bg-blue-50 dark:bg-blue-500/10 flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl ${sessionInvite.sessionType === 'VIDEO_MEETING' ? 'bg-emerald-600' : 'bg-blue-600'} text-white flex items-center justify-center`}>
                                    <Video size={18} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className={`text-[13px] font-bold ${sessionInvite.sessionType === 'VIDEO_MEETING' ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'}`}>
                                      {sessionInvite.sessionType === 'VIDEO_MEETING' ? 'Video meeting invite' : 'Remote session invite'}
                                    </p>
                                    <p className={`text-[12px] ${sessionInvite.sessionType === 'VIDEO_MEETING' ? 'text-emerald-500' : 'text-blue-500'} truncate`}>{sessionInvite.senderName || sender?.name || 'Someone'} invited you</p>
                                  </div>
                                </div>
                                <div className="p-4 space-y-3">
                                  <div>
                                    <p className="text-[12px] text-gray-500 dark:text-[#A0A0A0] mb-1">{sessionInvite.sessionType === 'VIDEO_MEETING' ? 'Meeting' : 'Session'}</p>
                                    <p className="text-[14px] font-bold text-gray-900 dark:text-white truncate">{sessionInvite.sessionName || 'Remote support session'}</p>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        if (sessionInvite.sessionType === 'VIDEO_MEETING') {
                                          onJoinMeeting?.(sessionInvite.sessionCode);
                                        } else {
                                          onJoinSessionInvite?.(sessionInvite.sessionCode, sessionInvite.sessionPassword);
                                        }
                                      }}
                                      className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${
                                        sessionInvite.sessionType === 'VIDEO_MEETING' 
                                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20' 
                                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
                                      }`}
                                    >
                                      <Video size={14} />
                                      {sessionInvite.sessionType === 'VIDEO_MEETING' ? 'Join' : 'Join'}
                                    </button>
                                    <button
                                      onClick={() => navigator.clipboard?.writeText(sessionInvite.sessionLink || '')}
                                      className="w-10 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors flex items-center justify-center"
                                      title="Copy join link"
                                    >
                                      <Copy size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className={`px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed ${
                                isMe 
                                  ? 'bg-[#1C202B] text-white rounded-tr-none' 
                                  : 'bg-[#F0F2F5] dark:bg-white/5 text-[#111111] dark:text-[#F5F5F5] rounded-tl-none'
                              }`}>
                                {msg.content}
                              </div>
                            )}
                            <span className="text-[11px] text-gray-400 mt-1">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          {activeConversation?.status === 'ACCEPTED' && (
            <div className="p-6 bg-white dark:bg-[#080808] border-t border-gray-100 dark:border-white/5 shrink-0">
              <div className="relative flex items-center gap-3">
                <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-[#A0A0A0] transition-colors">
                  <Paperclip size={20} />
                </button>
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type your message..." 
                    className="w-full bg-[#F0F2F5] dark:bg-white/5 text-[#111111] dark:text-[#F5F5F5] placeholder:text-gray-400 rounded-2xl py-3.5 pl-4 pr-12 text-[14px] outline-none focus:bg-white dark:focus:bg-[#1A1A1A] border border-transparent focus:border-gray-200 dark:focus:border-white/10 transition-all"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-[#A0A0A0] transition-colors">
                    <Smile size={20} />
                  </button>
                </div>
                <button 
                  onClick={handleSend}
                  className="w-12 h-12 bg-[#1C202B] text-white rounded-2xl flex items-center justify-center hover:bg-[#2A2F3D] transition-all shadow-lg shadow-black/10 active:scale-95"
                >
                  <CornerDownLeft size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#080808] text-gray-400">
          <Shield size={48} className="mb-4 text-gray-200 dark:text-white/10" />
          <h3 className="text-xl font-medium text-gray-600 dark:text-gray-300">Your messages are private</h3>
          <p className="mt-2 text-sm text-gray-500">Select a contact to start chatting</p>
        </div>
      )}

      {/* Session Invite Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1C1C1C] rounded-[24px] w-[520px] shadow-2xl p-7 font-sans relative">
            <button
              onClick={() => setShowSessionModal(false)}
              className="absolute top-7 right-7 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <X size={22} strokeWidth={1.5} />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center mb-5">
              <Video size={24} />
            </div>
            <h3 className="text-[22px] font-medium text-[#111111] dark:text-[#F5F5F5] mb-2">Create invitation</h3>
            <p className="text-[14px] text-gray-500 dark:text-[#A0A0A0] mb-6 leading-relaxed">
              Choose the type of session you want to start.
            </p>

            <div className="flex gap-2 mb-6 p-1 bg-gray-50 dark:bg-white/5 rounded-2xl">
              <button
                onClick={() => setSessionType('REMOTE_CONTROL')}
                className={`flex-1 py-3.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${sessionType === 'REMOTE_CONTROL' ? 'bg-white dark:bg-white/10 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                <Monitor size={16} />
                Remote Control
              </button>
              <button
                onClick={() => setSessionType('VIDEO_MEETING')}
                className={`flex-1 py-3.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${sessionType === 'VIDEO_MEETING' ? 'bg-white dark:bg-white/10 text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                <Video size={16} />
                Video Meeting
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Session name"
                className="w-full px-4 py-3 text-[14px] text-gray-900 dark:text-white bg-transparent rounded-xl border border-gray-200 dark:border-white/10 focus:outline-none focus:border-blue-600 transition-colors"
              />
              <input
                type="email"
                value={sessionInviteEmail}
                onChange={(e) => setSessionInviteEmail(e.target.value)}
                placeholder={activeConversation?.isGroup ? "Optional email copy" : "Recipient email"}
                className="w-full px-4 py-3 text-[14px] text-gray-900 dark:text-white bg-transparent rounded-xl border border-gray-200 dark:border-white/10 focus:outline-none focus:border-blue-600 transition-colors"
              />
              <div className="rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-gray-500">Join link</span>
                  <button onClick={() => navigator.clipboard?.writeText(sessionLink)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
                    <Copy size={14} />
                  </button>
                </div>
                <p className="text-[12px] font-medium text-[#111111] dark:text-[#F5F5F5] break-all">{sessionLink}</p>
              </div>
            </div>

            {sessionInviteMessage && (
              <div className={`flex items-center gap-2 text-[12px] font-medium mb-5 ${sessionInviteStatus === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
                {sessionInviteStatus === 'sent' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {sessionInviteMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSessionModal(false)}
                className="text-[14px] font-medium text-[#111111] dark:text-[#F5F5F5] hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-4 py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={handleSendSessionInvite}
                disabled={sessionInviteStatus === 'sending' || !sessionCode}
                className="px-6 py-2.5 rounded-lg text-[14px] font-medium transition-colors flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {sessionInviteStatus === 'sending' ? <RefreshCw size={16} className="animate-spin" /> : <Video size={16} />}
                {sessionType === 'VIDEO_MEETING' ? 'Start meeting' : 'Send session'}
              </button>
            </div>
          </div>
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
            
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => { setAddMode('contact'); setInviteError(null); }}
                className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${addMode === 'contact' ? 'bg-[#1C202B] text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300'}`}
              >
                Contact
              </button>
              <button
                onClick={() => { setAddMode('group'); setInviteError(null); }}
                className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors ${addMode === 'group' ? 'bg-[#1C202B] text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300'}`}
              >
                Group
              </button>
            </div>
            
            <h3 className="text-[22px] font-medium text-[#111111] dark:text-[#F5F5F5] mb-4">
              {addMode === 'contact' ? 'Add contact to your list' : 'Create a group'}
            </h3>
            
            <p className="text-[14px] text-gray-500 dark:text-[#A0A0A0] mb-8 leading-relaxed pr-8">
              {addMode === 'contact'
                ? 'Once the contact accepts your invitation, you can easily start a remote session and exchange messages.'
                : 'Create a shared space for a team, project, or discussion. Members can start messaging right away.'}
            </p>

            {addMode === 'contact' ? (
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
            ) : (
              <div className="space-y-4 mb-8">
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name"
                    className="w-full px-11 py-3.5 text-[14px] text-gray-900 dark:text-white bg-transparent rounded-xl border border-gray-200 dark:border-white/10 focus:outline-none focus:border-blue-600 transition-colors"
                  />
                </div>
                <textarea
                  value={groupEmails}
                  onChange={(e) => setGroupEmails(e.target.value)}
                  placeholder="Member emails, separated by commas or spaces"
                  className="w-full min-h-[110px] px-4 py-3.5 text-[14px] text-gray-900 dark:text-white bg-transparent rounded-xl border border-gray-200 dark:border-white/10 focus:outline-none focus:border-blue-600 transition-colors resize-none"
                />
              </div>
            )}

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
                onClick={addMode === 'contact' ? handleCreateChat : handleCreateGroup}
                disabled={(addMode === 'contact' ? !inviteEmail : !groupName || !groupEmails) || isInviting}
                className={`px-6 py-2.5 rounded-lg text-[14px] font-medium transition-colors flex items-center gap-2 ${
                  (addMode === 'contact' ? inviteEmail : groupName && groupEmails) && !isInviting
                    ? 'bg-[#00193F] text-white hover:bg-[#002255]' 
                    : 'bg-[#F0F2F5] dark:bg-[#2A2A2A] text-gray-400 dark:text-[#666666] pointer-events-none'
                }`}
              >
                {isInviting ? <RefreshCw size={16} className="animate-spin" /> : null}
                {isInviting ? 'Working...' : addMode === 'contact' ? 'Send invite' : 'Create group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Group Members Modal */}
      {showAddMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1C1C1C] rounded-[20px] w-[520px] shadow-2xl p-8 font-sans relative">
            <button 
              onClick={() => { setShowAddMembersModal(false); setMemberEmails(''); setInviteError(null); }}
              className="absolute top-8 right-8 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <X size={24} strokeWidth={1.5} />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center mb-6">
              <UserPlus size={24} />
            </div>
            <h3 className="text-[22px] font-medium text-[#111111] dark:text-[#F5F5F5] mb-3">Add members</h3>
            <p className="text-[14px] text-gray-500 dark:text-[#A0A0A0] mb-6 leading-relaxed pr-8">
              Add people to {getChatName(activeConversation)} by email. They will join the group immediately.
            </p>
            <textarea
              value={memberEmails}
              onChange={(e) => setMemberEmails(e.target.value)}
              placeholder="Member emails, separated by commas or spaces"
              className="w-full min-h-[120px] px-4 py-3.5 text-[14px] text-gray-900 dark:text-white bg-transparent rounded-xl border border-gray-200 dark:border-white/10 focus:outline-none focus:border-blue-600 transition-colors resize-none mb-4"
            />
            {inviteError && (
              <p className="text-[12px] text-red-500 font-medium mb-5 animate-in fade-in slide-in-from-top-1">
                {inviteError}
              </p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowAddMembersModal(false); setMemberEmails(''); setInviteError(null); }}
                className="text-[14px] font-medium text-[#111111] dark:text-[#F5F5F5] hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-4 py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMembers}
                disabled={!memberEmails || isInviting}
                className={`px-6 py-2.5 rounded-lg text-[14px] font-medium transition-colors flex items-center gap-2 ${
                  memberEmails && !isInviting
                    ? 'bg-[#00193F] text-white hover:bg-[#002255]'
                    : 'bg-[#F0F2F5] dark:bg-[#2A2A2A] text-gray-400 dark:text-[#666666] pointer-events-none'
                }`}
              >
                {isInviting ? <RefreshCw size={16} className="animate-spin" /> : null}
                {isInviting ? 'Adding...' : 'Add members'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Rename Modal */}
      {isRenaming && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#111111] w-full max-w-md p-8 rounded-[32px] shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setIsRenaming(false)}
              className="absolute top-8 right-8 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              <X size={24} strokeWidth={1.5} />
            </button>
            <h3 className="text-[22px] font-medium text-[#111111] dark:text-[#F5F5F5] mb-8">Rename Conversation</h3>
            <div className="relative mb-8">
              <input 
                type="text" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="block px-4 py-3.5 w-full text-[14px] text-gray-900 dark:text-white bg-transparent rounded-xl border border-gray-200 dark:border-white/10 focus:outline-none focus:border-blue-600 transition-colors" 
                placeholder="New conversation name" 
              />
            </div>
            <button 
              onClick={() => {
                if (newName.trim()) {
                  renameConversation(activeChatId!, newName);
                  setIsRenaming(false);
                }
              }}
              className="w-full py-4 bg-[#1C202B] text-white text-[13px] font-bold rounded-xl hover:bg-[#2A2F3D] transition-colors"
            >
              Update Name
            </button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#111111] w-full max-w-sm p-0 rounded-[32px] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="h-32 bg-gradient-to-br from-[#1C202B] to-[#2A2F3D]" />
            <button 
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="px-8 pb-10 -mt-12 text-center">
              <div className="relative inline-block mb-4">
                {activeParticipant?.avatar ? (
                  <img src={activeParticipant.avatar} alt={activeParticipant.name} className="w-24 h-24 rounded-[32px] border-4 border-white dark:border-[#111111] shadow-lg object-cover" />
                ) : (
                  <div className="w-24 h-24 bg-[#CDE6E8] text-[#1A3A3D] rounded-[32px] border-4 border-white dark:border-[#111111] shadow-lg flex items-center justify-center text-3xl font-bold">
                    {activeParticipant?.name?.charAt(0) || activeParticipant?.email?.charAt(0) || '?'}
                  </div>
                )}
                <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#71DD8C] rounded-full border-2 border-white dark:border-[#111111]" />
              </div>
              
              <h3 className="text-xl font-bold text-[#111111] dark:text-[#F5F5F5] mb-1">{activeParticipant?.name || 'Unknown Contact'}</h3>
              <p className="text-[13px] text-gray-500 mb-6">{activeParticipant?.email}</p>
              
              <div className="grid grid-cols-2 gap-3 mb-8 text-left">
                <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-2xl">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Role</p>
                  <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200">{activeParticipant?.role || 'Member'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-2xl">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Status</p>
                  <p className="text-[12px] font-medium text-[#71DD8C]">Available</p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowProfileModal(false)}
                className="w-full py-3.5 bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-white text-[12px] font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors uppercase tracking-widest"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#111111] w-full max-w-sm p-8 rounded-[32px] shadow-2xl relative text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            
            <h3 className="text-[20px] font-bold text-[#111111] dark:text-[#F5F5F5] mb-2">Delete Conversation?</h3>
            <p className="text-[14px] text-gray-500 dark:text-[#A0A0A0] mb-8">
              {activeConversation?.isGroup
                ? 'You will leave this group and stop receiving new messages from it.'
                : 'This will permanently remove this chat and all messages for you. This action cannot be undone.'}
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  deleteConversation(activeChatId!);
                  setShowDeleteModal(false);
                }}
                className="w-full py-3.5 bg-red-500 text-white text-[13px] font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                {activeConversation?.isGroup ? 'Leave Group' : 'Delete for Me'}
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-3.5 bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-white text-[12px] font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
