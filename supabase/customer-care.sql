-- Customer Care: reviews + support chat
-- Run in Supabase SQL Editor

CREATE TYPE support_status AS ENUM ('open', 'closed');

CREATE TABLE customer_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE support_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT 'General inquiry',
  status support_status DEFAULT 'open',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_role user_role NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Reviews
CREATE POLICY "Anyone can view approved reviews" ON customer_reviews
  FOR SELECT USING (is_approved = TRUE);

CREATE POLICY "Users can view own reviews" ON customer_reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create reviews" ON customer_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage reviews" ON customer_reviews
  FOR ALL USING (public.is_admin());

-- Conversations
CREATE POLICY "Users can view own conversations" ON support_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create conversations" ON support_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage conversations" ON support_conversations
  FOR ALL USING (public.is_admin());

-- Messages
CREATE POLICY "Users can view messages in own conversations" ON support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM support_conversations
      WHERE support_conversations.id = support_messages.conversation_id
      AND support_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in own conversations" ON support_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND sender_role = 'user'
    AND EXISTS (
      SELECT 1 FROM support_conversations
      WHERE support_conversations.id = conversation_id
      AND support_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all messages" ON support_messages
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can send messages" ON support_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND sender_role = 'admin'
    AND public.is_admin()
  );

-- Realtime for live chat
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
