// src/services/chatStorage.ts — Supabase-backed chat persistence
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface StoredMessage {
  id: string;
  thread_id: string;
  role: string;       // 'user' | 'agent'
  content: string;
  agent: string;      // 'estimation' | 'negotiation' | 'booking'
  metadata: Record<string, any>;
  created_at: string;
}

class ChatStorage {
  private supabase: SupabaseClient | null = null;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (url && key) {
      this.supabase = createClient(url, key);
      console.log('[ChatStorage] Connected to Supabase');
    } else {
      console.log('[ChatStorage] No Supabase config — chat persistence disabled');
    }
  }

  private get sb(): SupabaseClient {
    if (!this.supabase) throw new Error('Supabase not configured');
    return this.supabase;
  }

  /** Create or update a conversation row */
  async upsertConversation(threadId: string, opts?: { clientName?: string; clientEmail?: string; source?: string }): Promise<void> {
    if (!this.supabase) return;
    try {
      const { error } = await this.sb
        .from('conversations')
        .upsert({
          thread_id: threadId,
          client_name: opts?.clientName || '',
          client_email: opts?.clientEmail || '',
          source: opts?.source || 'direct',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'thread_id' });

      if (error) console.warn('[ChatStorage] upsertConversation error:', error.message);
    } catch (err: any) {
      console.warn('[ChatStorage] upsertConversation failed:', err.message);
    }
  }

  /** Save a single message */
  async saveMessage(threadId: string, role: string, content: string, opts?: { agent?: string; metadata?: Record<string, any> }): Promise<void> {
    if (!this.supabase) return;
    try {
      // Ensure conversation exists
      await this.upsertConversation(threadId);

      const { error } = await this.sb
        .from('messages')
        .insert({
          thread_id: threadId,
          role,
          content,
          agent: opts?.agent || '',
          metadata: opts?.metadata || {},
        });

      if (error) console.warn('[ChatStorage] saveMessage error:', error.message);
    } catch (err: any) {
      console.warn('[ChatStorage] saveMessage failed:', err.message);
    }
  }

  /** Load all messages for a thread, ordered chronologically */
  async loadMessages(threadId: string): Promise<StoredMessage[]> {
    if (!this.supabase) return [];
    try {
      const { data, error } = await this.sb
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[ChatStorage] loadMessages error:', error.message);
        return [];
      }
      return (data as StoredMessage[]) || [];
    } catch (err: any) {
      console.warn('[ChatStorage] loadMessages failed:', err.message);
      return [];
    }
  }

  /** Update client info on an existing conversation */
  async updateClientInfo(threadId: string, name?: string, email?: string): Promise<void> {
    if (!this.supabase) return;
    try {
      const updates: Record<string, string> = { updated_at: new Date().toISOString() };
      if (name) updates.client_name = name;
      if (email) updates.client_email = email;

      const { error } = await this.sb
        .from('conversations')
        .update(updates)
        .eq('thread_id', threadId);

      if (error) console.warn('[ChatStorage] updateClientInfo error:', error.message);
    } catch (err: any) {
      console.warn('[ChatStorage] updateClientInfo failed:', err.message);
    }
  }
}

export const chatStorage = new ChatStorage();
