'use client';

import { useEffect, useState, useRef } from 'react';
import { MessageCircle, Send, CheckCircle, Star, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import type { CustomerReview, SupportConversation, SupportMessage } from '@/types/database';

export default function AdminSupportPage() {
  const [section, setSection] = useState<'chat' | 'reviews'>('chat');
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selected, setSelected] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [pendingReviews, setPendingReviews] = useState<CustomerReview[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('support_conversations')
      .select('*, profile:profiles(full_name, email, city, country)')
      .order('last_message_at', { ascending: false });
    setConversations((data as SupportConversation[]) || []);
  };

  const loadPendingReviews = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('customer_reviews')
      .select('*, profile:profiles(full_name, city, country)')
      .eq('is_approved', false)
      .order('created_at', { ascending: false });
    setPendingReviews((data as CustomerReview[]) || []);
  };

  const loadMessages = async (conversationId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('support_messages')
      .select('*, profile:profiles(full_name)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages((data as SupportMessage[]) || []);
  };

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setAdminId(user?.id ?? null);
      await loadConversations();
      await loadPendingReviews();
    }
    init();
  }, []);

  useEffect(() => {
    if (!selected?.id) return;

    loadMessages(selected.id);

    const supabase = createClient();
    const channel = supabase
      .channel(`admin-support-${selected.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `conversation_id=eq.${selected.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as SupportMessage;
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', newMsg.sender_id)
            .single();

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, profile: profile || undefined }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selected?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !adminId || !reply.trim()) return;

    setLoading(true);
    const supabase = createClient();

    const { data: sent, error } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: selected.id,
        sender_id: adminId,
        sender_role: 'admin',
        message: reply.trim(),
      })
      .select('*, profile:profiles(full_name)')
      .single();

    if (!error && sent) {
      setMessages((prev) => [...prev, sent as SupportMessage]);
      setReply('');
      await supabase
        .from('support_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selected.id);
      loadConversations();
    }
    setLoading(false);
  };

  const closeConversation = async (id: string) => {
    const supabase = createClient();
    await supabase.from('support_conversations').update({ status: 'closed' }).eq('id', id);
    loadConversations();
    if (selected?.id === id) setSelected(null);
  };

  const approveReview = async (id: string) => {
    const supabase = createClient();
    await supabase.from('customer_reviews').update({ is_approved: true }).eq('id', id);
    loadPendingReviews();
  };

  const deleteReview = async (id: string) => {
    if (!confirm('Delete this review?')) return;
    const supabase = createClient();
    await supabase.from('customer_reviews').delete().eq('id', id);
    loadPendingReviews();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Care</h1>
          <p className="text-sm text-gray-500 mt-1">Reply to customer chats and approve reviews</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSection('chat')}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
              section === 'chat' ? 'bg-layali-black text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Chats ({conversations.filter((c) => c.status === 'open').length})
          </button>
          <button
            onClick={() => setSection('reviews')}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
              section === 'reviews' ? 'bg-layali-black text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Star className="w-4 h-4" />
            Pending Reviews ({pendingReviews.length})
          </button>
        </div>
      </div>

      {section === 'chat' && (
        <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-220px)] min-h-[500px]">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 font-medium text-gray-900">Conversations</div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No conversations yet</p>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelected(conv)}
                    className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      selected?.id === conv.id ? 'bg-layali-pink-light/30' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm text-gray-900">{conv.profile?.full_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        conv.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {conv.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{conv.profile?.email}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(conv.last_message_at)}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                Select a conversation to reply
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{selected.profile?.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {selected.profile?.city}, {selected.profile?.country} · {selected.profile?.email}
                    </p>
                  </div>
                  {selected.status === 'open' && (
                    <button
                      onClick={() => closeConversation(selected.id)}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" /> Close
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          msg.sender_role === 'admin'
                            ? 'bg-layali-black text-white rounded-br-sm'
                            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${msg.sender_role === 'admin' ? 'text-white/50' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {selected.status === 'open' ? (
                  <form onSubmit={sendReply} className="p-4 border-t border-gray-100 flex gap-2">
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type your reply..."
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-layali-pink"
                    />
                    <Button type="submit" loading={loading} size="sm">
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                ) : (
                  <p className="p-4 text-center text-sm text-gray-400 border-t">This conversation is closed</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {section === 'reviews' && (
        <div className="space-y-4">
          {pendingReviews.length === 0 ? (
            <p className="text-gray-400 text-center py-12 bg-white rounded-2xl border border-gray-100">
              No pending reviews
            </p>
          ) : (
            pendingReviews.map((review) => (
              <div key={review.id} className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">{review.profile?.full_name}</p>
                    <p className="text-xs text-gray-500">{formatDate(review.created_at)}</p>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-4 h-4 ${n <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
                      />
                    ))}
                  </div>
                </div>
                <h3 className="font-medium text-gray-900 mb-1">{review.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{review.content}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approveReview(review.id)}>
                    <CheckCircle className="w-4 h-4" /> Approve
                  </Button>
                  <button
                    onClick={() => deleteReview(review.id)}
                    className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-full flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
