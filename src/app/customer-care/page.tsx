'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Star, MessageCircle, Mail, Send, Headphones } from 'lucide-react';
import { CONTACT_EMAIL } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FadeIn } from '@/components/ui/FadeIn';
import { formatDate } from '@/lib/utils';
import type { CustomerReview, SupportConversation, SupportMessage } from '@/types/database';

type Tab = 'reviews' | 'contact';

function CustomerCareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'contact' ? 'contact' : 'reviews';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [userId, setUserId] = useState<string | null>(null);

  // Reviews
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', content: '' });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState('');

  // Chat
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const me = await fetch('/api/account/me', { cache: 'no-store' });
      const meJson = (await me.json()) as { signedIn?: boolean; customer?: { id: string } };
      const userId = meJson.signedIn ? meJson.customer?.id || null : null;
      setUserId(userId);

      const reviewRes = await fetch('/api/admin/reviews?approved=1', { cache: 'no-store' });
      const reviewJson = (await reviewRes.json()) as { reviews?: CustomerReview[] };
      setReviews(reviewJson.reviews || []);

      if (userId) {
        const supportRes = await fetch('/api/support', { cache: 'no-store' });
        const supportJson = (await supportRes.json()) as {
          conversation?: SupportConversation | null;
          messages?: SupportMessage[];
        };
        if (supportJson.conversation) {
          setConversation(supportJson.conversation);
          setMessages(supportJson.messages || []);
        }
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    const timer = window.setInterval(async () => {
      const supportRes = await fetch('/api/support', { cache: 'no-store' });
      const supportJson = (await supportRes.json()) as { messages?: SupportMessage[] };
      if (supportJson.messages) setMessages(supportJson.messages);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [conversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      router.push('/auth/signin?redirect=/customer-care');
      return;
    }

    setReviewLoading(true);
    setReviewSuccess('');
    const response = await fetch('/api/admin/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewForm),
    });
    if (response.ok) {
      setReviewSuccess('Thank you! Your review has been submitted and will appear after approval.');
      setReviewForm({ rating: 5, title: '', content: '' });
    }
    setReviewLoading(false);
  };

  const startOrSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      router.push('/auth/signin?redirect=/customer-care?tab=contact');
      return;
    }
    if (!newMessage.trim()) return;

    setChatLoading(true);
    const response = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newMessage.trim(), conversationId: conversation?.id }),
    });
    const json = (await response.json()) as { conversation?: SupportConversation; message?: SupportMessage };
    if (response.ok && json.message) {
      if (json.conversation) setConversation(json.conversation);
      setMessages((prev) => [...prev, json.message as SupportMessage]);
      setNewMessage('');
    }

    setChatLoading(false);
  };

  return (
    <div className="min-h-screen bg-transparent pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        <FadeIn className="text-center mb-10">
          <Headphones className="w-10 h-10 mx-auto text-layali-pink mb-4" />
          <h1 className="font-serif text-heading-lg text-white mb-2">Customer Care</h1>
          <p className="text-body text-white/50">We&apos;re here for you — share a review or chat with our team</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 mt-4 text-sm text-layali-pink hover:text-layali-pink-light transition-colors"
          >
            <Mail className="w-4 h-4" />
            {CONTACT_EMAIL}
          </a>
        </FadeIn>

        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {(['reviews', 'contact'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`min-h-11 px-5 py-2.5 rounded-full text-sm font-medium transition-all inline-flex items-center gap-2 border ${
                tab === t
                  ? 'bg-layali-pink-glow text-white border-layali-pink-glow shadow-[0_0_16px_rgba(212,46,124,0.35)]'
                  : 'bg-transparent text-white/50 border-white/15 hover:border-layali-pink/40 hover:text-white'
              }`}
            >
              {t === 'reviews' ? <Star className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
              {t === 'reviews' ? 'Customer Reviews' : 'Contact Us'}
            </button>
          ))}
        </div>

        {tab === 'reviews' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-ui-heading text-white mb-4">Write a Review</h2>
              {!userId ? (
                <p className="text-sm text-white/50 mb-4">
                  <Link href="/auth/signin?redirect=/customer-care" className="text-layali-pink font-medium hover:underline">
                    Sign in
                  </Link>{' '}
                  to share your experience with Layali.
                </p>
              ) : (
                <form onSubmit={submitReview} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Rating</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setReviewForm({ ...reviewForm, rating: n })}
                          className="inline-flex items-center justify-center min-h-11 min-w-11"
                          aria-label={`Rate ${n} stars`}
                        >
                          <Star
                            className={`w-6 h-6 ${
                              n <= reviewForm.rating ? 'text-layali-gold fill-layali-gold' : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    label="Title"
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Your Review</label>
                    <textarea
                      value={reviewForm.content}
                      onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
                      required
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-layali-pink/30"
                      placeholder="Tell us about your experience..."
                    />
                  </div>
                  {reviewSuccess && (
                    <p className="text-sm text-green-600 bg-green-50 p-3 rounded-xl">{reviewSuccess}</p>
                  )}
                  <Button type="submit" loading={reviewLoading}>Submit Review</Button>
                </form>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="font-serif text-heading-sm text-white">What Our Customers Say</h2>
              {reviews.length === 0 ? (
                <p className="text-white/50 text-center py-8">No reviews yet. Be the first to share!</p>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="glass-panel rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-white">{review.profile?.full_name || 'Layali Customer'}</p>
                        {review.profile?.city && (
                          <p className="text-xs text-white/50">{review.profile.city}, {review.profile.country}</p>
                        )}
                      </div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`w-4 h-4 ${
                              n <= review.rating ? 'text-layali-gold fill-layali-gold' : 'text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <h3 className="font-medium text-white mb-1">{review.title}</h3>
                    <p className="text-sm text-white/70 leading-relaxed">{review.content}</p>
                    <p className="text-xs text-white/40 mt-3">{formatDate(review.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {tab === 'contact' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-layali-surface rounded-2xl border border-layali-pink/20 overflow-hidden flex flex-col h-[500px]">
              <div className="p-4 border-b border-layali-pink/20 bg-layali-pink-glow/15">
                <h2 className="text-ui-heading text-white">Chat with Layali Support</h2>
                <p className="text-xs text-white/50">Our team typically replies within a few hours</p>
              </div>

              {!userId ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <MessageCircle className="w-12 h-12 text-layali-pink mb-4" />
                  <p className="text-white/50 mb-4">Sign in to start a conversation with our support team.</p>
                  <Link href="/auth/signin?redirect=/customer-care?tab=contact">
                    <Button>Sign In to Chat</Button>
                  </Link>
                  <p className="text-sm text-white/50 mt-6">
                    Or email us at{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-layali-pink hover:underline">
                      {CONTACT_EMAIL}
                    </a>
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 && (
                      <p className="text-center text-sm text-white/50 py-8">
                        Send a message to start chatting with our team ✦
                      </p>
                    )}
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                            msg.sender_role === 'user'
                              ? 'bg-layali-black text-white rounded-br-sm'
                              : 'bg-layali-pink-glow/25 text-white rounded-bl-sm'
                          }`}
                        >
                          {msg.sender_role === 'admin' && (
                            <p className="text-xs font-medium opacity-70 mb-0.5">Layali Support</p>
                          )}
                          <p className="text-sm">{msg.message}</p>
                          <p className={`text-[10px] mt-1 ${msg.sender_role === 'user' ? 'text-white/50' : 'text-white/40'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={startOrSendMessage} className="p-4 border-t border-layali-pink/20 flex gap-2">
                    <input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-3 rounded-xl border border-layali-pink/30 focus:outline-none focus:ring-2 focus:ring-layali-pink"
                    />
                    <Button type="submit" loading={chatLoading} size="sm">
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function CustomerCarePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-layali-surface flex items-center justify-center">Loading...</div>}>
      <CustomerCareContent />
    </Suspense>
  );
}
