import { apiClient } from './client';
import type {
  CalendarResponse, CategoryBrief, City, HallPhoto, PriceUnit,
  ProviderAttr, PublicProviderDetails,
} from './types';

export interface ProviderBody {
  category_id: number;
  city_id: number;
  name: string;
  description?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price_from?: number | null;
  price_unit?: PriceUnit | null;
  attr_ids?: number[];
}

export type ProviderPatchBody = Partial<ProviderBody> & { is_active?: boolean };

export interface OwnerProviderFull {
  id: number;
  guid: string;
  category_id: number;
  city_id: number;
  name: string;
  description: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  price_from: number | null;
  price_unit: PriceUnit | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  photos: HallPhoto[];
  attrs: ProviderAttr[];
}

export interface MyProvider extends OwnerProviderFull {
  category: CategoryBrief;
  main_thumb: string | null;
}

export interface UploadedPhoto {
  id: number;
  file_path: string;
  thumb_path: string;
  sort_order: number;
}

/** Owner CRUD исполнителя + публичные детали/календарь (для карточки). */
export const providersApi = {
  async my(): Promise<{ items: MyProvider[] }> {
    const { data } = await apiClient.get<{ items: MyProvider[] }>('/providers/my');
    return data;
  },

  async create(body: ProviderBody): Promise<{ provider: OwnerProviderFull }> {
    const { data } = await apiClient.post<{ provider: OwnerProviderFull }>('/providers', body);
    return data;
  },

  async get(guid: string): Promise<{ provider: OwnerProviderFull }> {
    const { data } = await apiClient.get<{ provider: OwnerProviderFull }>(`/providers/${guid}`);
    return data;
  },

  async patch(guid: string, body: ProviderPatchBody): Promise<{ provider: OwnerProviderFull }> {
    const { data } = await apiClient.patch<{ provider: OwnerProviderFull }>(
      `/providers/${guid}`, body,
    );
    return data;
  },

  async remove(guid: string): Promise<{ deleted: true }> {
    const { data } = await apiClient.delete<{ deleted: true }>(`/providers/${guid}`);
    return data;
  },

  async uploadPhotos(
    providerGuid: string,
    files: { uri: string; name: string; type: string }[],
  ): Promise<{ items: UploadedPhoto[] }> {
    const form = new FormData();
    for (const f of files) {
      // @ts-expect-error React Native FormData file shape
      form.append('files', { uri: f.uri, name: f.name, type: f.type });
    }
    const { data } = await apiClient.post<{ items: UploadedPhoto[] }>(
      `/providers/${providerGuid}/photos`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  async deletePhoto(photoId: number): Promise<{ deleted: true }> {
    const { data } = await apiClient.delete<{ deleted: true }>(`/providers/photos/${photoId}`);
    return data;
  },

  async reorderPhotos(providerGuid: string, photoIds: number[]): Promise<{ items: HallPhoto[] }> {
    const { data } = await apiClient.patch<{ items: HallPhoto[] }>(
      `/providers/${providerGuid}/photos/order`,
      { photo_ids: photoIds },
    );
    return data;
  },

  /** Публичные детали исполнителя (карточка C07). */
  async getPublic(guid: string): Promise<{ provider: PublicProviderDetails & { city: City } }> {
    const { data } = await apiClient.get<{ provider: PublicProviderDetails & { city: City } }>(
      `/search/providers/${guid}`,
    );
    return data;
  },

  /** Календарь занятости исполнителя (требует JWT). */
  async calendar(guid: string, month: string): Promise<CalendarResponse> {
    const { data } = await apiClient.get<CalendarResponse>(
      `/providers/${guid}/calendar`,
      { params: { month } },
    );
    return data;
  },
};
