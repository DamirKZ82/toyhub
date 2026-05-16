import { apiClient } from './client';

/** Унифицированный subject чата — зал или исполнитель. */
export interface ChatSubject {
  type: 'hall' | 'provider';
  guid: string | null;
  name: string | null;
  main_thumb: string | null;
  main_photo: string | null;
  category_code?: string | null;
}

export interface ChatListItem {
  guid: string;
  /** Унифицированный subject (есть всегда). */
  subject: ChatSubject;
  /** Заполнено, если чат привязан к залу. */
  hall: {
    guid: string;
    name: string;
    main_thumb: string | null;
    main_photo: string | null;
    price_weekday: number | null;
    price_weekend: number | null;
  } | null;
  /** Заполнено, если чат привязан к исполнителю. */
  provider: {
    guid: string;
    name: string;
    main_thumb: string | null;
    main_photo: string | null;
    price_from: number | null;
    price_unit: 'event' | 'hour' | 'person' | 'day' | null;
    category_code: string | null;
  } | null;
  /** Заявка — опционально. null если юзер ещё не подал заявку */
  booking: {
    guid: string;
    event_date: string;
    status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  } | null;
  other_user: { name: string | null; phone: string | null };
  last_message_at: string | null;
  last_message_preview: string | null;
  /** true — последнее сообщение отправил текущий юзер; null если сообщений ещё нет */
  last_message_is_mine: boolean | null;
  /** true — последнее сообщение прочитано получателем (имеет смысл только если last_message_is_mine=true) */
  last_message_read: boolean | null;
  unread_count: number;
  /** true — я владелец зала в этом чате, false — я клиент-заказчик */
  is_owner: boolean;
}

export interface ChatMessage {
  guid: string;
  text: string;
  sender_id: number;
  is_mine: boolean;
  created_at: string;
  read_at: string | null;
}

export interface ChatDetails {
  chat: ChatListItem;
  messages: ChatMessage[];
}

export const chatsApi = {
  async list(): Promise<{ items: ChatListItem[] }> {
    const { data } = await apiClient.get<{ items: ChatListItem[] }>('/chats');
    return data;
  },

  async unreadCount(): Promise<{ unread_count: number }> {
    const { data } = await apiClient.get<{ unread_count: number }>('/chats/unread-count');
    return data;
  },

  async get(guid: string): Promise<ChatDetails> {
    const { data } = await apiClient.get<ChatDetails>(`/chats/${guid}`);
    return data;
  },

  async send(guid: string, text: string): Promise<{ message: ChatMessage }> {
    const { data } = await apiClient.post<{ message: ChatMessage }>(
      `/chats/${guid}/messages`,
      { text },
    );
    return data;
  },

  async markRead(guid: string): Promise<{ marked: true }> {
    const { data } = await apiClient.post<{ marked: true }>(`/chats/${guid}/mark-read`);
    return data;
  },

  /**
   * Создать (или получить существующий) чат с владельцем зала.
   * Используется кнопкой "Написать" на карточке зала.
   */
  async openWithHall(hallGuid: string): Promise<{ chat_guid: string }> {
    const { data } = await apiClient.post<{ chat_guid: string }>(
      `/halls/${hallGuid}/chat`,
    );
    return data;
  },

  /** Создать (или получить) чат с исполнителем. Кнопка "Написать" на карточке C07. */
  async openWithProvider(providerGuid: string): Promise<{ chat_guid: string }> {
    const { data } = await apiClient.post<{ chat_guid: string }>(
      `/providers/${providerGuid}/chat`,
    );
    return data;
  },
};
