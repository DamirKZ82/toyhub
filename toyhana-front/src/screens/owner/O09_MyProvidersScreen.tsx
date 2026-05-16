import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button, FAB } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Loader } from '@/components/Loader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';

import { providersApi, dictsApi, ApiError } from '@/api';
import type { MyProvider } from '@/api';
import type { City } from '@/api/types';
import { API_BASE_URL } from '@/config';
import { dictName } from '@/utils/i18nDict';
import { useAuthStore } from '@/store/authStore';
import { radii, spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { useThemeColors } from '@/theme/useThemeColors';
import type { ProfileStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MyProviders'>;

export default function MyProvidersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');
  const c = useThemeColors();

  const styles = useStyles((cc) => ({
    list: { padding: spacing.md, flexGrow: 1 },
    errWrap: { marginBottom: spacing.sm },
    emptyWrap: { flex: 1, justifyContent: 'center' as const, paddingHorizontal: spacing.lg },
    emptyBtn: { marginHorizontal: spacing.xl, marginTop: spacing.md },
    card: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: cc.surface,
      borderRadius: radii.lg,
      marginBottom: spacing.md,
      padding: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: cc.outline,
    },
    thumb: { width: 72, height: 72, borderRadius: radii.md, backgroundColor: cc.surfaceVariant },
    noThumb: { alignItems: 'center' as const, justifyContent: 'center' as const },
    body: { flex: 1, marginLeft: spacing.sm },
    name: { fontSize: 16, fontWeight: '700' as const, color: cc.onSurface },
    meta: { fontSize: 13, color: cc.muted, marginTop: 2 },
    inactive: { fontSize: 12, color: cc.error, marginTop: 4 },
    fab: {
      position: 'absolute' as const,
      right: spacing.md,
      bottom: spacing.md,
      backgroundColor: cc.primary,
    },
  }));

  const [items, setItems] = useState<MyProvider[]>([]);
  const [cities, setCities] = useState<Record<number, City>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [prov, citiesResp] = await Promise.all([
        providersApi.my(),
        dictsApi.cities(),
      ]);
      setItems(prov.items);
      const map: Record<number, City> = {};
      for (const cc of citiesResp.items) map[cc.id] = cc;
      setCities(map);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <Screen><Loader /></Screen>;

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(p) => p.guid}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListHeaderComponent={
          error ? <View style={styles.errWrap}><ErrorBanner message={error} /></View> : null
        }
        ListEmptyComponent={
          !error ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                title={t('owner.providers_empty_title')}
                subtitle={t('owner.providers_empty_hint')}
              />
              <Button
                mode="contained"
                icon="plus"
                onPress={() => navigation.navigate('ProviderForm', {})}
                style={styles.emptyBtn}
              >
                {t('owner.add_provider')}
              </Button>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const thumb = item.main_thumb ? `${API_BASE_URL}${item.main_thumb}` : null;
          const city = cities[item.city_id];
          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('ProviderForm', { providerGuid: item.guid })}
            >
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.noThumb]}>
                  <Icon name="account-star" size={32} color={c.muted} />
                </View>
              )}
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {dictName(item.category, lang)}
                  {city ? ` · ${dictName(city, lang)}` : ''}
                </Text>
                {!item.is_active ? (
                  <Text style={styles.inactive}>{t('owner.provider_inactive')}</Text>
                ) : null}
              </View>
              <Icon name="chevron-right" size={24} color={c.muted} />
            </Pressable>
          );
        }}
      />

      {items.length > 0 ? (
        <FAB
          icon="plus"
          style={styles.fab}
          color={c.onPrimary}
          onPress={() => navigation.navigate('ProviderForm', {})}
          label={t('owner.add_provider')}
        />
      ) : null}
    </Screen>
  );
}
