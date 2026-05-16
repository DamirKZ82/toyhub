import { create } from 'zustand';
import { favoritesApi } from '@/api';

interface FavoritesState {
  /** Множество guid'ов (UUID — глобально уникальны, залы и исполнители вместе). */
  guids: Set<string>;
  loaded: boolean;
  load: () => Promise<void>;
  toggle: (hallGuid: string, isNowFav: boolean) => Promise<void>;
  toggleProvider: (providerGuid: string, isNowFav: boolean) => Promise<void>;
  isFav: (guid: string) => boolean;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  guids: new Set<string>(),
  loaded: false,

  load: async () => {
    try {
      const { items } = await favoritesApi.list();
      const guids = new Set<string>();
      for (const i of items) {
        if (i.type === 'provider') guids.add(i.provider.guid);
        else guids.add(i.hall.guid);
      }
      set({ guids, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  toggle: async (hallGuid, isNowFav) => {
    const next = new Set(get().guids);
    if (isNowFav) next.add(hallGuid); else next.delete(hallGuid);
    set({ guids: next });
    try {
      if (isNowFav) await favoritesApi.add(hallGuid);
      else await favoritesApi.remove(hallGuid);
    } catch {
      const rollback = new Set(get().guids);
      if (isNowFav) rollback.delete(hallGuid); else rollback.add(hallGuid);
      set({ guids: rollback });
    }
  },

  toggleProvider: async (providerGuid, isNowFav) => {
    const next = new Set(get().guids);
    if (isNowFav) next.add(providerGuid); else next.delete(providerGuid);
    set({ guids: next });
    try {
      if (isNowFav) await favoritesApi.addProvider(providerGuid);
      else await favoritesApi.removeProvider(providerGuid);
    } catch {
      const rollback = new Set(get().guids);
      if (isNowFav) rollback.delete(providerGuid); else rollback.add(providerGuid);
      set({ guids: rollback });
    }
  },

  isFav: (guid) => get().guids.has(guid),

  clear: () => set({ guids: new Set(), loaded: false }),
}));
