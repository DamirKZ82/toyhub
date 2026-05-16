import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, CommonActions } from '@react-navigation/native';

import { Loader } from '@/components/Loader';
import { ErrorBanner } from '@/components/ErrorBanner';

import { chatsApi, ApiError } from '@/api';
import type { ChatDetails, ChatMessage } from '@/api';
import { radii, spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { useThemeColors } from '@/theme/useThemeColors';
import { formatDateHuman, formatPrice } from '@/utils/format';
import { API_BASE_URL } from '@/config';
import { useAuthStore } from '@/store/authStore';
import type { MessagesStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Chat'>;

type Row =
  | { kind: 'msg'; msg: ChatMessage }
  | { kind: 'day'; key: string; label: string };

const POLL_INTERVAL_MS = 4000;  // чаще чем список — это "горячий" экран

/** Цвет статуса заявки для бейджа в шапке чата */
function bookingStatusColor(
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled',
  c: { primary: string; warningFg: string; errorFg: string; muted: string },
): string {
  if (status === 'confirmed') return c.primary;
  if (status === 'pending') return c.warningFg;
  if (status === 'rejected') return c.errorFg;
  return c.muted; // cancelled
}

export default function ChatScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');
  const c = useThemeColors();
  const { chatGuid } = route.params;

  const styles = useStyles((cc) => ({
    root: { flex: 1, backgroundColor: cc.background },

    // Карточка зала — всегда сверху чата (как в Krisha).
    hallCard: {
      flexDirection: 'row' as const,
      padding: spacing.sm,
      backgroundColor: cc.surfaceVariant,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: cc.outline,
    },
    hallPhoto: {
      width: 64, height: 64, borderRadius: radii.sm,
      backgroundColor: cc.surface,
      marginRight: spacing.sm,
    },
    hallPhotoPlaceholder: {
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    hallBody: { flex: 1, justifyContent: 'space-between' as const },
    hallName: { fontSize: 14, fontWeight: '700' as const, color: cc.onSurface },
    hallPrice: { fontSize: 14, color: cc.primary, fontWeight: '700' as const },
    hallGoBtn: {
      marginTop: spacing.xs,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    hallGoText: { fontSize: 12, color: cc.primary, fontWeight: '600' as const },
    bookingBadge: {
      alignSelf: 'flex-start' as const,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.sm,
      marginTop: 4,
    },
    bookingBadgeText: { fontSize: 11, fontWeight: '600' as const },

    list: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexGrow: 1 },

    dayLabelWrap: { alignItems: 'center' as const, marginVertical: spacing.sm },
    dayLabel: {
      backgroundColor: cc.surfaceVariant,
      color: cc.onSurfaceVariant,
      fontSize: 12,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.sm,
      overflow: 'hidden' as const,
    },

    bubbleRow: { marginVertical: 2, maxWidth: '80%' as const },
    bubbleMine: { alignSelf: 'flex-end' as const },
    bubbleOther: { alignSelf: 'flex-start' as const },
    bubble: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.lg,
    },
    bubbleMineBg: { backgroundColor: cc.primary, borderBottomRightRadius: 4 },
    bubbleOtherBg: { backgroundColor: cc.surfaceVariant, borderBottomLeftRadius: 4 },
    bubbleText: { fontSize: 15, lineHeight: 20 },
    bubbleTextMine: { color: cc.onPrimary },
    bubbleTextOther: { color: cc.onSurface },
    bubbleMeta: { fontSize: 10, marginTop: 2 },
    bubbleMetaMine: { color: cc.onPrimary, opacity: 0.75, textAlign: 'right' as const },
    bubbleMetaOther: { color: cc.muted },

    empty: {
      flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const,
      padding: spacing.lg,
    },
    emptyText: { fontSize: 14, color: cc.muted, textAlign: 'center' as const },

    composer: {
      flexDirection: 'row' as const, alignItems: 'flex-end' as const,
      padding: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: cc.outline,
      backgroundColor: cc.background,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radii.lg,
      backgroundColor: cc.surfaceVariant,
      color: cc.onSurface,
      fontSize: 15,
    },
    sendBtn: {
      marginLeft: spacing.sm,
      width: 40, height: 40, borderRadius: radii.pill,
      alignItems: 'center' as const, justifyContent: 'center' as const,
      backgroundColor: cc.primary,
    },
    sendBtnDisabled: { backgroundColor: cc.muted },
  }));

  const [details, setDetails] = useState<ChatDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef<FlatList<Row>>(null);
  const prevLenRef = useRef(0);

  const load = useCallback(async (background = false) => {
    if (!background) setError(null);
    try {
      const d = await chatsApi.get(chatGuid);
      setDetails(d);
      navigation.setOptions({ title: d.chat.other_user.name ?? t('messages.chat_title') });
      // автоматически помечаем как прочитанные, но только если было непрочитанное
      if (d.chat.unread_count > 0) {
        chatsApi.markRead(chatGuid).catch(() => { /* игнорим */ });
      }
    } catch (e) {
      if (!background) setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setLoading(false);
    }
  }, [chatGuid, navigation, t]);

  useFocusEffect(useCallback(() => {
    load();
    const id = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]));

  // Авто-скролл вниз при появлении новых сообщений
  useEffect(() => {
    if (!details) return;
    const n = details.messages.length;
    if (n > prevLenRef.current) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
    prevLenRef.current = n;
  }, [details]);

  const onSend = async () => {
    const val = text.trim();
    if (!val || sending) return;
    setSending(true);
    setError(null);
    try {
      const resp = await chatsApi.send(chatGuid, val);
      // Оптимистично добавляем сообщение в локальный список
      setDetails((prev) => prev ? {
        ...prev,
        messages: [...prev.messages, resp.message],
        chat: {
          ...prev.chat,
          last_message_at: resp.message.created_at,
          last_message_preview: resp.message.text.slice(0, 100),
        },
      } : prev);
      setText('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => iso.slice(11, 16);

  // Разделитель дней — всегда полной датой "24 апреля 2026" (Krisha-стиль).
  const dayLabel = (iso: string): string => {
    return formatDateHuman(iso.slice(0, 10), lang);
  };

  if (loading) {
    return <View style={styles.root}><Loader /></View>;
  }
  if (!details) {
    return (
      <View style={styles.root}>
        <ErrorBanner message={error ?? t('common.error_generic')} />
      </View>
    );
  }

  // Собираем массив: сообщения + разделители-дни
  const rows: Row[] = [];
  let lastDate = '';
  for (const m of details.messages) {
    const d = m.created_at.slice(0, 10);
    if (d !== lastDate) {
      rows.push({ kind: 'day', key: `day-${d}`, label: dayLabel(m.created_at) });
      lastDate = d;
    }
    rows.push({ kind: 'msg', msg: m });
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {details.chat.subject.guid ? (
        <Pressable
          style={styles.hallCard}
          onPress={() => {
            const s = details.chat.subject;
            navigation.getParent()?.dispatch(
              CommonActions.navigate({
                name: 'Search',
                params: s.type === 'provider'
                  ? { screen: 'ProviderDetails', params: { providerGuid: s.guid } }
                  : { screen: 'HallDetails', params: { hallGuid: s.guid } },
              }),
            );
          }}
        >
          {details.chat.subject.main_thumb ? (
            <Image
              source={{ uri: `${API_BASE_URL}${details.chat.subject.main_thumb}` }}
              style={styles.hallPhoto}
            />
          ) : (
            <View style={[styles.hallPhoto, styles.hallPhotoPlaceholder]}>
              <Icon name="image-outline" size={28} color={c.muted} />
            </View>
          )}
          <View style={styles.hallBody}>
            <View>
              <Text style={styles.hallName} numberOfLines={1}>
                {details.chat.subject.name}
              </Text>
              {details.chat.hall?.price_weekday ? (
                <Text style={styles.hallPrice}>
                  {t('hall.price_weekday_from', { price: formatPrice(details.chat.hall.price_weekday) })}
                </Text>
              ) : details.chat.provider?.price_from != null ? (
                <Text style={styles.hallPrice}>
                  {t('hall.price_weekday_from', { price: formatPrice(details.chat.provider.price_from) })}
                </Text>
              ) : null}
            </View>
            {details.chat.booking ? (
              <View style={[
                styles.bookingBadge,
                { backgroundColor: bookingStatusColor(details.chat.booking.status, c) + '20' },
              ]}>
                <Text style={[
                  styles.bookingBadgeText,
                  { color: bookingStatusColor(details.chat.booking.status, c) },
                ]}>
                  {t(`bookings.status_${details.chat.booking.status}`)}
                  {' · '}
                  {formatDateHuman(details.chat.booking.event_date, lang)}
                </Text>
              </View>
            ) : (
              <View style={styles.hallGoBtn}>
                <Text style={styles.hallGoText}>{t('messages.go_to_hall')}</Text>
                <Icon name="chevron-right" size={14} color={c.primary} />
              </View>
            )}
          </View>
        </Pressable>
      ) : null}

      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r, i) => r.kind === 'msg' ? r.msg.guid : r.key + i}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('messages.no_messages_yet')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'day') {
            return (
              <View style={styles.dayLabelWrap}>
                <Text style={styles.dayLabel}>{item.label}</Text>
              </View>
            );
          }
          const m = item.msg;
          return (
            <View
              style={[
                styles.bubbleRow,
                m.is_mine ? styles.bubbleMine : styles.bubbleOther,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  m.is_mine ? styles.bubbleMineBg : styles.bubbleOtherBg,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    m.is_mine ? styles.bubbleTextMine : styles.bubbleTextOther,
                  ]}
                >
                  {m.text}
                </Text>
                <Text
                  style={[
                    styles.bubbleMeta,
                    m.is_mine ? styles.bubbleMetaMine : styles.bubbleMetaOther,
                  ]}
                >
                  {formatTime(m.created_at)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('messages.placeholder')}
          placeholderTextColor={c.muted}
          multiline
          style={styles.input}
        />
        <Pressable
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!text.trim() || sending}
        >
          <Icon name="send" size={20} color={c.onPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
