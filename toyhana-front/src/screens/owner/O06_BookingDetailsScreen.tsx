import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Loader } from '@/components/Loader';
import { ErrorBanner } from '@/components/ErrorBanner';
import { BottomModal } from '@/components/BottomModal';

import { bookingsApi, dictsApi, ApiError } from '@/api';
import type { Booking, EventType } from '@/api/types';
import { radii, spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { useThemeColors } from '@/theme/useThemeColors';
import { formatDateHuman, formatPrice } from '@/utils/format';
import { dictName } from '@/utils/i18nDict';
import { useAuthStore } from '@/store/authStore';
import type { ProfileStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<ProfileStackParamList, 'BookingDetails'>;

export default function BookingDetailsScreen({ route, navigation }: Props) {
  const styles = useStyles((c) => ({
  hallName: { fontSize: 22, fontWeight: '700', color: c.onSurface },
  venue: { fontSize: 14, color: c.muted, marginTop: 4, marginBottom: spacing.md },
  block: {
    backgroundColor: c.surfaceVariant,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: { marginBottom: spacing.sm },
  label: { fontSize: 12, fontWeight: '600', color: c.muted, textTransform: 'uppercase' },
  value: { fontSize: 15, color: c.onSurface, marginTop: 2 },
  actions: {
    flexDirection: 'row', gap: spacing.sm,
    marginTop: spacing.lg, marginBottom: spacing.lg,
  },
  rejectBtn: { flex: 1, borderColor: c.error },
  confirmBtn: { flex: 1 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: c.onSurface, marginBottom: spacing.md },
  modalInput: { backgroundColor: c.surface, minHeight: 90, marginBottom: spacing.md },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
}));

  const colors = useThemeColors();

  const { t } = useTranslation();
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');
  const { bookingGuid } = route.params;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [bk, types] = await Promise.all([
        bookingsApi.get(bookingGuid),
        dictsApi.eventTypes(),
      ]);
      setBooking(bk.booking);
      setEventTypes(types.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message || t('common.error_generic'));
    } finally {
      setLoading(false);
    }
  }, [bookingGuid, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirm = async () => {
    if (!booking) return;
    setActionLoading(true);
    setError(null);
    try {
      const resp = await bookingsApi.confirm(booking.guid);
      const rejectedCount = resp.auto_rejected_count;
      Alert.alert(
        t('owner.confirm_success'),
        rejectedCount > 0
          ? t('owner.confirm_auto_rejected', { count: rejectedCount })
          : '',
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async () => {
    if (!booking) return;
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      await bookingsApi.reject(booking.guid, rejectReason.trim());
      setRejectOpen(false);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Screen><Loader /></Screen>;
  if (!booking) return <Screen><ErrorBanner message={error ?? t('common.error_generic')} /></Screen>;

  const eventType = booking.event_type_id
    ? eventTypes.find((e) => e.id === booking.event_type_id)
    : null;

  return (
    <Screen scroll>
      <ErrorBanner message={error} />

      <Text style={styles.hallName}>
        {booking.subject.name ?? t('bookings.subject_deleted')}
      </Text>
      <Text style={styles.venue}>{booking.subject.parent_name ?? ''}</Text>

      <View style={styles.block}>
        <View style={styles.row}>
        <Text style={styles.label}>{t('owner.booking_date')}</Text>
        <Text style={styles.value}>{formatDateHuman(booking.event_date, lang)}</Text>
      </View>
        <View style={styles.row}>
        <Text style={styles.label}>{t('owner.booking_guests')}</Text>
        <Text style={styles.value}>{String(booking.guests_count)}</Text>
      </View>
        {eventType ? <View style={styles.row}>
        <Text style={styles.label}>{t('owner.booking_event_type')}</Text>
        <Text style={styles.value}>{dictName(eventType, lang)}</Text>
      </View> : null}
        {booking.price_at_booking != null ? (
          <View style={styles.row}>
        <Text style={styles.label}>{t('owner.booking_price')}</Text>
        <Text style={styles.value}>{formatPrice(booking.price_at_booking)}</Text>
      </View>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>{t('owner.booking_client')}</Text>
        <Text style={styles.value}>{booking.client?.name ?? '—'}</Text>
        <Text style={styles.label}>{t('owner.booking_phone')}</Text>
        <Text style={styles.value}>{booking.client?.phone ?? '—'}</Text>
      </View>

      {booking.comment ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t('owner.booking_comment')}</Text>
          <Text style={styles.value}>{booking.comment}</Text>
        </View>
      ) : null}

      {booking.status === 'rejected' && booking.rejected_reason ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t('bookings.status_rejected')}</Text>
          <Text style={styles.value}>{booking.rejected_reason}</Text>
        </View>
      ) : null}

      {booking.status === 'pending' ? (
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={() => setRejectOpen(true)}
            textColor={colors.error}
            style={styles.rejectBtn}
            disabled={actionLoading}
          >
            {t('owner.reject_button')}
          </Button>
          <Button
            mode="contained"
            onPress={confirm}
            loading={actionLoading}
            disabled={actionLoading}
            style={styles.confirmBtn}
          >
            {t('owner.confirm_button')}
          </Button>
        </View>
      ) : null}

      <BottomModal visible={rejectOpen} onClose={() => setRejectOpen(false)}>
        <Text style={styles.modalTitle}>{t('owner.reject_reason_title')}</Text>
        <TextInput
          mode="outlined"
          value={rejectReason}
          onChangeText={setRejectReason}
          placeholder={t('owner.reject_reason_placeholder')}
          multiline
          numberOfLines={3}
          style={styles.modalInput}
        />
        <View style={styles.modalActions}>
          <Button mode="text" onPress={() => setRejectOpen(false)}>{t('common.cancel')}</Button>
          <Button
            mode="contained"
            onPress={reject}
            loading={actionLoading}
            disabled={actionLoading || !rejectReason.trim()}
            buttonColor={colors.error}
          >
            {t('owner.reject_confirm')}
          </Button>
        </View>
      </BottomModal>
    </Screen>
  );
}

