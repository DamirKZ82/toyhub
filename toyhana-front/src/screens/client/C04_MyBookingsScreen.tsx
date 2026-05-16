import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button, Chip } from 'react-native-paper';
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
import { formatDateHuman, formatPrice, todayIso } from '@/utils/format';
import { useAuthStore } from '@/store/authStore';
import type { ProfileStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MyBookings'>;

type Filter = 'all' | BookingStatus;

export default function MyBookingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');
  const c = useThemeColors();

  const styles = useStyles((cc) => ({
    filtersRow: { flexDirection: 'row' as const, padding: spacing.md, flexWrap: 'wrap' as const },
    filterChip: { marginRight: spacing.sm, marginBottom: spacing.sm },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
    card: {
      backgroundColor: cc.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: cc.outline,
    },
    hallName: { fontSize: 16, fontWeight: '700' as const, color: cc.onSurface },
    meta: { fontSize: 14, color: cc.muted, marginTop: 4 },
    price: { fontSize: 14, color: cc.primary, marginTop: 4, fontWeight: '600' as const },
    badge: {
      alignSelf: 'flex-start' as const,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    badgeText: { fontSize: 12, fontWeight: '600' as const },
    rejReason: { fontSize: 13, color: cc.muted, marginTop: spacing.sm },
    actionsRow: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, marginTop: spacing.sm },
  }));

  const [items, setItems] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const resp = await bookingsApi.my(filter === 'all' ? undefined : filter);
      setItems(resp.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const tryCancel = (b: Booking) => {
    Alert.alert(
      t('bookings.cancel_confirm_title'),
      t('bookings.cancel_confirm_text'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('bookings.cancel_yes'),
          style: 'destructive',
          onPress: async () => {
            try {
              await bookingsApi.cancel(b.guid);
              load();
            } catch { /* ignore */ }
          },
        },
      ],
    );
  };

  const badgeStyle = (status: BookingStatus) => {
    const map: Record<BookingStatus, { bg: string; fg: string; label: string }> = {
      pending:   { bg: c.warningBg, fg: c.warningFg, label: t('bookings.status_pending') },
      confirmed: { bg: c.successBg, fg: c.successFg, label: t('bookings.status_confirmed') },
      rejected:  { bg: c.errorBg,   fg: c.errorFg,   label: t('bookings.status_rejected') },
      cancelled: { bg: c.mutedBg,   fg: c.muted,     label: t('bookings.status_cancelled') },
    };
    return map[status];
  };

  const today = todayIso();

  return (
    <Screen padded={false}>
      <View style={styles.filtersRow}>
        {(['all', 'pending', 'confirmed', 'rejected'] as Filter[]).map((f) => (
          <Chip
            key={f}
            selected={filter === f}
            showSelectedOverlay
            onPress={() => setFilter(f)}
            style={styles.filterChip}
          >
            {t(`bookings.filter_${f}`)}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
          ListEmptyComponent={
            !error ? (
              <EmptyState title={t('bookings.empty_title')} subtitle={t('bookings.empty_hint')} />
            ) : null
          }
          renderItem={({ item }) => {
            const eventPassed = item.event_date < today;
            const canReview =
              item.status === 'confirmed' &&
              eventPassed &&
              !item.subject.deleted;
            const canCancel = item.status === 'pending' || item.status === 'confirmed';
            const b = badgeStyle(item.status);

            const openSubject = () => {
              if (item.subject.deleted || !item.subject.guid) return;
              if (item.subject.type === 'provider') {
                navigation.navigate('ProviderDetails', { providerGuid: item.subject.guid });
              } else {
                navigation.navigate('HallDetails', { hallGuid: item.subject.guid });
              }
            };

            return (
              <View style={styles.card}>
                <Pressable onPress={openSubject}>
                  <Text style={styles.hallName} numberOfLines={1}>
                    {item.subject.deleted || !item.subject.name
                      ? t('bookings.subject_deleted')
                      : item.subject.name}
                  </Text>
                  <Text style={styles.meta}>
                    {formatDateHuman(item.event_date, lang)} · {item.guests_count} {t('search.guests_word')}
                  </Text>
                  {item.price_at_booking != null ? (
                    <Text style={styles.price}>{formatPrice(item.price_at_booking)}</Text>
                  ) : null}
                </Pressable>

                <View style={[styles.badge, { backgroundColor: b.bg }]}>
                  <Text style={[styles.badgeText, { color: b.fg }]}>{b.label}</Text>
                </View>

                {item.status === 'rejected' && item.rejected_reason ? (
                  <Text style={styles.rejReason}>
                    {t('bookings.rejected_reason', { reason: item.rejected_reason })}
                  </Text>
                ) : null}

                <View style={styles.actionsRow}>
                  {canCancel ? (
                    <Button mode="text" textColor={c.error} onPress={() => tryCancel(item)}>
                      {t('bookings.cancel_button')}
                    </Button>
                  ) : null}
                  {canReview ? (
                    <Button
                      mode="contained-tonal"
                      onPress={() =>
                        navigation.navigate('ReviewForm', {
                          bookingGuid: item.guid,
                          subjectName: item.subject.name ?? '',
                        })
                      }
                    >
                      {t('bookings.leave_review')}
                    </Button>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}
