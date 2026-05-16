import { apiClient } from './client';
import type {
  Amenity, Category, City, EventType, Holiday, ProviderAttrType,
} from './types';

export const dictsApi = {
  async categories(): Promise<{ items: Category[] }> {
    const { data } = await apiClient.get('/dicts/categories');
    return data;
  },
  async providerAttrTypes(category?: string): Promise<{ items: ProviderAttrType[] }> {
    const { data } = await apiClient.get('/dicts/provider-attr-types', {
      params: category ? { category } : {},
    });
    return data;
  },
  async cities(): Promise<{ items: City[] }> {
    const { data } = await apiClient.get('/dicts/cities');
    return data;
  },
  async amenities(): Promise<{ items: Amenity[] }> {
    const { data } = await apiClient.get('/dicts/amenities');
    return data;
  },
  async eventTypes(): Promise<{ items: EventType[] }> {
    const { data } = await apiClient.get('/dicts/event-types');
    return data;
  },
  async holidays(): Promise<{ items: Holiday[] }> {
    const { data } = await apiClient.get('/dicts/holidays');
    return data;
  },
};
