import { apiClient } from './client';
import type { Review, ReviewsResponse } from './types';

export const reviewsApi = {
  async list(hallGuid: string): Promise<ReviewsResponse> {
    const { data } = await apiClient.get<ReviewsResponse>(`/halls/${hallGuid}/reviews`);
    return data;
  },

  async listProvider(providerGuid: string): Promise<ReviewsResponse> {
    const { data } = await apiClient.get<ReviewsResponse>(
      `/providers/${providerGuid}/reviews`,
    );
    return data;
  },

  async create(booking_guid: string, rating: number, text?: string): Promise<{ review: Review }> {
    const { data } = await apiClient.post<{ review: Review }>(
      '/reviews',
      { booking_guid, rating, text },
    );
    return data;
  },

  async reply(reviewGuid: string, reply_text: string): Promise<{ review: Review }> {
    const { data } = await apiClient.post<{ review: Review }>(
      `/reviews/${reviewGuid}/reply`,
      { reply_text },
    );
    return data;
  },
};
