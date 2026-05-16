import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Chip } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Loader } from '@/components/Loader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';

import { bookingsApi, ApiError } from '@/api';
import type { Booking, BookingStatus } from '@/api/types';
import { radii, spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { useThemeColors } from '@/theme/useThemeColors';
import { formatDateHuman, formatPrice } from '@/utils/format';
import { useAuthStore } from '@/store/authStore';
import type { ProfileStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<ProfileStackParamList, 'IncomingBookings'>;
type Filter = 'all' | BookingStatus;

export default function IncomingBookingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');
  const c = useThemeColors();

  const styles = useStyles((cc) => ({
    filtersRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, padding: spacing.md },
    chip: { marginRight: spacing.sm, marginBottom: spacing.sm },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
    card: {
      backgroundColor: cc.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: cc.outline,
    },
    cardTop: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    hallName: { fontSize: 16, fontWeight: '700' as const, color: cc.onSurface, flex: 1, marginRight: spacing.sm },
    date: { fontSize: 14, color: cc.muted, marginTop: 4 },
    client: { fontSize: 13, color: cc.onSurface, marginTop: 4 },
    price: { fontSize: 14, color: cc.primary, marginTop: 4, fontWeight: '600' as const },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    badgeText: { fontSize: 12, fontWeight: '600' as const },
  }));

  const [items, setItems] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const resp = await bookingsApi.incoming(filter === 'all' ? undefined : filter);
      setItems(resp.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const badgeStyle = (status: BookingStatus) => {
    const map: Record<BookingStatus, { bg: string; fg: string; label: string }> = {
      pending:   { bg: c.warningBg, fg: c.warningFg, label: t('bookings.status_pending') },
      confirmed: { bg: c.successBg, fg: c.successFg, label: t('bookings.status_confirmed') },
      rejected:  { bg: c.errorBg,   fg: c.errorFg,   label: t('bookings.status_rejected') },
      cancelled: { bg: c.mutedBg,   fg: c.muted,     label: t('bookings.status_cancelled') },
    };
    return map[status];
  };

  return (
    <Screen padded={false}>
      <View style={styles.filtersRow}>
        {(['all', 'pending', 'confirmed', 'rejected'] as Filter[]).map((f) => (
          <Chip
            key={f}
            selected={filter === f}
            showSelectedOverlay
            onPress={() => setFilter(f)}
            style={styles.chip}
          >
            {t(`owner.incoming_filter_${f}`)}
          </Chip>
        ))}
      </View>

      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.guid}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
          ListEmptyComponent={
            !error ? (
              <EmptyState
                title={t('owner.incoming_empty_title')}
                subtitle={t('owner.incoming_empty_hint')}
              />
            ) : null
          }
          renderItem={({ item }) => {
            const b = badgeStyle(item.status);
            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate('BookingDetails', { bookingGuid: item.guid })}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.hallName} numberOfLines={1}>
                    {item.subject.name ?? t('bookings.subject_deleted')}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: b.bg }]}>
                    <Text style={[styles.badgeText, { color: b.fg }]}>{b.label}</Text>
                  </View>
                </View>
                <Text style={styles.date}>
                  {formatDateHuman(item.event_date, lang)} · {item.guests_count} {t('search.guests_word')}
                </Text>
                {item.client ? (
                  <Text style={styles.client}>
                    {item.client.name ?? '—'} · {item.client.phone ?? ''}
                  </Text>
                ) : null}
                {item.price_at_booking != null ? (
                  <Text style={styles.price}>{formatPrice(item.price_at_booking)}</Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
