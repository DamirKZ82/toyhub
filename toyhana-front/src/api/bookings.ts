import { apiClient } from './client';
import type { Booking, BookingStatus } from './types';

export interface BookingCreateBody {
  /** Ровно одно из двух. */
  hall_guid?: string;
  provider_guid?: string;
  event_date: string;
  guests_count: number;
  event_type_id?: number;
  comment?: string;
}

export const bookingsApi = {
  async create(body: BookingCreateBody): Promise<{ booking: Booking }> {
    const { data } = await apiClient.post<{ booking: Booking }>('/bookings', body);
    return data;
  },

  async get(guid: string): Promise<{ booking: Booking }> {
    const { data } = await apiClient.get<{ booking: Booking }>(`/bookings/${guid}`);
    return data;
  },

  async my(status?: BookingStatus): Promise<{ items: Booking[] }> {
    const { data } = await apiClient.get<{ items: Booking[] }>(
      '/bookings/my',
      { params: status ? { status } : {} },
    );
    return data;
  },

  async incoming(status?: BookingStatus): Promise<{ items: Booking[] }> {
    const { data } = await apiClient.get<{ items: Booking[] }>(
      '/bookings/incoming',
      { params: status ? { status } : {} },
    );
    return data;
  },

  async confirm(guid: string): Promise<{ booking: Booking; auto_rejected_count: number }> {
    const { data } = await apiClient.post(`/bookings/${guid}/confirm`);
    return data;
  },

  async reject(guid: string, reason: string): Promise<{ booking: Booking }> {
    const { data } = await apiClient.post(`/bookings/${guid}/reject`, { reason });
    return data;
  },

  async cancel(guid: string): Promise<{ booking: Booking }> {
    const { data } = await apiClient.post(`/bookings/${guid}/cancel`);
    return data;
  },
};
