'use client';

import { useEffect, useState, useRef } from 'react';
import { MessageCircle, Send, CheckCircle, Star, Trash2 } from 'lucide-react';
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
    const response = await fetch('/api/support?scope=admin', { cache: 'no-store' });
    const json = (await response.json()) as { conversations?: SupportConversation[] };
    setConversations(json.conversations || []);
  };

  const loadPendingReviews = async () => {
    const response = await fetch('/api/admin/reviews', { cache: 'no-store' });
    const json = (await response.json()) as { reviews?: CustomerReview[] };
    setPendingReviews(json.reviews || []);
  };

  const loadMessages = async (conversationId: string) => {
    const response = await fetch('/api/support?scope=admin', { cache: 'no-store' });
    const json = (await response.json()) as { messages?: SupportMessage[] };
    setMessages((json.messages || []).filter((message) => message.conversation_id === conversationId));
  };

  useEffect(() => {
    async function init() {
      const me = await fetch('/api/account/me', { cache: 'no-store' });
      const json = (await me.json()) as { customer?: { id: string } };
      setAdminId(json.customer?.id ?? null);
      await loadConversations();
      await loadPendingReviews();
    }
    init();
  }, []);

  useEffect(() => {
    if (!selected?.id) return;

    const conversationId = selected.id;
    void Promise.resolve().then(() => {
      loadMessages(conversationId);
    });

    const timer = window.setInterval(() => {
      void loadMessages(conversationId);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selected?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !adminId || !reply.trim()) return;

    setLoading(true);
    const response = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'admin',
        conversationId: selected.id,
        message: reply.trim(),
      }),
    });
    const json = (await response.json()) as { message?: SupportMessage };
    if (response.ok && json.message) {
      setMessages((prev) => [...prev, json.message as SupportMessage]);
      setReply('');
      loadConversations();
    }
    setLoading(false);
  };

  const closeConversation = async (id: string) => {
    await fetch('/api/support', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'closed' }),
    });
    loadConversations();
    if (selected?.id === id) setSelected(null);
  };

  const approveReview = async (id: string) => {
    await fetch('/api/admin/reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_approved: true }),
    });
    loadPendingReviews();
  };

  const deleteReview = async (id: string) => {
    if (!confirm('Delete this review?')) return;
    await fetch(`/api/admin/reviews?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
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
