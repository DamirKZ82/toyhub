import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Chip, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CommonActions } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Loader } from '@/components/Loader';
import { ErrorBanner } from '@/components/ErrorBanner';
import { DatePickerSheet } from '@/components/DatePicker';

import { bookingsApi, dictsApi, hallsApi, providersApi, ApiError } from '@/api';
import type { CalendarDay, EventType } from '@/api/types';
import { radii, spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { useThemeColors } from '@/theme/useThemeColors';
import { formatDateHuman, formatPrice, monthOf, todayIso } from '@/utils/format';
import { dictName } from '@/utils/i18nDict';
import { useAuthStore } from '@/store/authStore';
import type { SearchStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KEYBOARD_TOOLBAR_ID } from '@/components/KeyboardToolbar';

type Props = NativeStackScreenProps<SearchStackParamList, 'BookingForm'>;

interface Subject {
  guid: string;
  name: string;
  isHall: boolean;
  capacityMin: number | null;
  capacityMax: number | null;
  basePrice: number | null;
}

export default function BookingFormScreen({ route, navigation }: Props) {
  const styles = useStyles((c) => ({
    title: { fontSize: 22, fontWeight: '700', color: c.onSurface },
    subjectName: { fontSize: 15, color: c.muted, marginTop: 4, marginBottom: spacing.lg },
    label: {
      fontSize: 13, fontWeight: '600', color: c.muted,
      textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.md,
    },
    dateField: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: c.outline, borderRadius: radii.sm,
      paddingHorizontal: spacing.md, paddingVertical: 14,
      backgroundColor: c.surface,
    },
    dateText: { marginLeft: spacing.sm, fontSize: 15, color: c.onSurface },
    placeholder: { color: c.muted },
    priceHint: { fontSize: 13, color: c.muted, marginTop: spacing.sm },
    input: { backgroundColor: c.surface },
    chips: { flexDirection: 'row', flexWrap: 'wrap' },
    chip: { marginRight: spacing.sm, marginBottom: spacing.sm },
    submit: { marginTop: spacing.lg, marginBottom: spacing.lg, paddingVertical: spacing.xs },
  }));

  const colors = useThemeColors();

  const { t } = useTranslation();
  const { hallGuid, providerGuid, initialDate } = route.params;
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');

  const [subject, setSubject] = useState<Subject | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState<string | null>(initialDate ?? null);
  const [dateOpen, setDateOpen] = useState(false);
  const [guests, setGuests] = useState('');
  const [eventTypeId, setEventTypeId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [calCache, setCalCache] = useState<Record<string, CalendarDay[]>>({});
  const [shownMonth] = useState(monthOf(todayIso()));

  useEffect(() => {
    (async () => {
      try {
        const [et] = await Promise.all([dictsApi.eventTypes()]);
        setEventTypes(et.items);
        if (providerGuid) {
          const p = await providersApi.getPublic(providerGuid);
          setSubject({
            guid: p.provider.guid,
            name: p.provider.name,
            isHall: false,
            capacityMin: null,
            capacityMax: null,
            basePrice: p.provider.price_from,
          });
        } else if (hallGuid) {
          const h = await hallsApi.getPublic(hallGuid);
          setSubject({
            guid: h.hall.guid,
            name: h.hall.name,
            isHall: true,
            capacityMin: h.hall.capacity_min,
            capacityMax: h.hall.capacity_max,
            basePrice: h.hall.price_weekday,
          });
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : t('common.error_generic'));
      } finally {
        setLoading(false);
      }
    })();
  }, [hallGuid, providerGuid, t]);

  // Календарь на текущий месяц (для подсветки занятых дат и цены)
  useEffect(() => {
    if (!dateOpen || !subject) return;
    if (calCache[shownMonth]) return;
    (async () => {
      try {
        const resp = subject.isHall
          ? await hallsApi.calendar(subject.guid, shownMonth)
          : await providersApi.calendar(subject.guid, shownMonth);
        setCalCache((prev) => ({ ...prev, [shownMonth]: resp.items }));
      } catch { /* ignore */ }
    })();
  }, [dateOpen, shownMonth, subject, calCache]);

  const calendarAll: CalendarDay[] = React.useMemo(
    () => Object.values(calCache).flat(),
    [calCache],
  );

  const priceOnDate = React.useMemo(() => {
    if (!subject || !date) return null;
    const match = calendarAll.find((d) => d.date === date);
    return match?.price ?? subject.basePrice;
  }, [subject, date, calendarAll]);

  const submit = async () => {
    if (!subject) return;
    if (!date) { setError(t('booking_form.need_date')); return; }
    const n = parseInt(guests, 10);
    if (!Number.isFinite(n) || n <= 0) { setError(t('booking_form.need_guests')); return; }

    setSubmitting(true);
    setError(null);
    try {
      await bookingsApi.create({
        hall_guid: subject.isHall ? subject.guid : undefined,
        provider_guid: subject.isHall ? undefined : subject.guid,
        event_date: date,
        guests_count: n,
        event_type_id: eventTypeId ?? undefined,
        comment: comment.trim() || undefined,
      });
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'SearchHome' }] }),
      );
      navigation.getParent()?.dispatch(
        CommonActions.navigate({ name: 'Messages', params: { screen: 'MessagesHome' } }),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Screen><Loader /></Screen>;
  if (!subject) {
    return <Screen><ErrorBanner message={error ?? t('common.error_generic')} /></Screen>;
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>{t('booking_form.title')}</Text>
      <Text style={styles.subjectName}>{subject.name}</Text>

      <ErrorBanner message={error} />

      <Text style={styles.label}>{t('booking_form.date_label')}</Text>
      <Pressable style={styles.dateField} onPress={() => setDateOpen(true)}>
        <Icon name="calendar" size={18} color={colors.muted} />
        <Text style={[styles.dateText, !date && styles.placeholder]}>
          {date ? formatDateHuman(date, lang) : t('booking_form.date_placeholder')}
        </Text>
      </Pressable>

      {priceOnDate != null && date ? (
        <Text style={styles.priceHint}>
          {t('booking_form.price_on_date', { date: formatDateHuman(date, lang) })}: {formatPrice(priceOnDate)}
        </Text>
      ) : null}

      <Text style={styles.label}>{t('booking_form.guests_label')}</Text>
      <TextInput
        mode="outlined"
        keyboardType="number-pad"
        inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
        value={guests}
        onChangeText={(v) => setGuests(v.replace(/\D/g, '').slice(0, 5))}
        placeholder={
          subject.capacityMax
            ? `${subject.capacityMin ?? 1}-${subject.capacityMax}`
            : '150'
        }
        style={styles.input}
      />

      <Text style={styles.label}>{t('booking_form.event_type_label')}</Text>
      <View style={styles.chips}>
        {eventTypes.map((et) => (
          <Chip
            key={et.id}
            selected={eventTypeId === et.id}
            showSelectedOverlay
            onPress={() => setEventTypeId(eventTypeId === et.id ? null : et.id)}
            style={styles.chip}
          >
            {dictName(et, lang)}
          </Chip>
        ))}
      </View>

      <Text style={styles.label}>{t('booking_form.comment_label')}</Text>
      <TextInput
        mode="outlined"
        value={comment}
        onChangeText={setComment}
        placeholder={t('booking_form.comment_placeholder')}
        multiline
        numberOfLines={3}
        style={[styles.input, { minHeight: 90 }]}
      />

      <Button
        mode="contained"
        onPress={submit}
        loading={submitting}
        disabled={submitting}
        style={styles.submit}
      >
        {t('booking_form.submit')}
      </Button>

      <DatePickerSheet
        visible={dateOpen}
        value={date}
        onChange={setDate}
        onClose={() => setDateOpen(false)}
        calendar={calendarAll}
        blockPending={false}
        title={t('booking_form.date_label')}
      />
    </Screen>
  );
}
