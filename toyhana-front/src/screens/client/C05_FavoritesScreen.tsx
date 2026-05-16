import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Loader } from '@/components/Loader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { HallCard } from '@/components/HallCard';
import { ProviderCard } from '@/components/ProviderCard';

import { favoritesApi, ApiError } from '@/api';
import type { FavoriteItem } from '@/api/types';
import { useAuthStore } from '@/store/authStore';
import { useAuthGateStore } from '@/store/authGateStore';
import { useFavoritesStore } from '@/store/favoritesStore';
import { spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import type { FavoritesStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<FavoritesStackParamList, 'FavoritesHome'>;

export default function FavoritesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAuthed = !!token && !!user?.full_name;
  const openGate = useAuthGateStore((s) => s.open);

  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(isAuthed);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFav = useFavoritesStore((s) => s.toggle);
  const toggleProviderFav = useFavoritesStore((s) => s.toggleProvider);
  const favGuids = useFavoritesStore((s) => s.guids);

  const guestStyles = useStyles((c) => ({
    wrap: {
      flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const,
      padding: spacing.lg,
    },
    title: { fontSize: 18, fontWeight: '700' as const, color: c.onSurface, textAlign: 'center' as const },
    subtitle: {
      fontSize: 14, color: c.muted, textAlign: 'center' as const,
      marginTop: spacing.sm, marginBottom: spacing.lg,
    },
    btn: { minWidth: 200 },
  }));

  const load = useCallback(async () => {
    if (!isAuthed) { setLoading(false); return; }
    setError(null);
    try {
      const resp = await favoritesApi.list();
      setItems(resp.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthed, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleToggleHall = async (hallGuid: string) => {
    await toggleFav(hallGuid, !favGuids.has(hallGuid));
    setItems((prev) => prev.filter(
      (it) => it.type !== 'hall' || it.hall.guid !== hallGuid,
    ));
  };

  const handleToggleProvider = async (providerGuid: string) => {
    await toggleProviderFav(providerGuid, !favGuids.has(providerGuid));
    setItems((prev) => prev.filter(
      (it) => it.type !== 'provider' || it.provider.guid !== providerGuid,
    ));
  };

  // Гостевой режим
  if (!isAuthed) {
    return (
      <Screen>
        <View style={guestStyles.wrap}>
          <Text style={guestStyles.title}>{t('favorites.guest_title')}</Text>
          <Text style={guestStyles.subtitle}>{t('favorites.guest_subtitle')}</Text>
          <Button
            mode="contained"
            onPress={() => openGate('favorite')}
            style={guestStyles.btn}
          >
            {t('profile.login')}
          </Button>
        </View>
      </Screen>
    );
  }

  if (loading) return <Screen><Loader /></Screen>;

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(it, idx) =>
          (it.type === 'provider' ? it.provider?.guid : it.hall?.guid) ?? String(idx)
        }
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
        ListEmptyComponent={
          !error ? (
            <EmptyState title={t('favorites.empty_title')} subtitle={t('favorites.empty_hint')} />
          ) : null
        }
        renderItem={({ item }) => (
          item.type === 'provider' ? (
            <ProviderCard
              item={item}
              isFavorite
              onToggleFavorite={() => handleToggleProvider(item.provider.guid)}
              onPress={() =>
                navigation.navigate('ProviderDetails', { providerGuid: item.provider.guid })
              }
            />
          ) : (
            <HallCard
              item={item}
              isFavorite
              onToggleFavorite={() => handleToggleHall(item.hall.guid)}
              onPress={() => navigation.navigate('HallDetails', { hallGuid: item.hall.guid })}
            />
          )
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
});
