import React, { useCallback, useState } from 'react';
import {
  FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { Button } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Loader } from '@/components/Loader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';

import { chatsApi, ApiError } from '@/api';
import type { ChatListItem } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { useAuthGateStore } from '@/store/authGateStore';
import { radii, spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { useThemeColors } from '@/theme/useThemeColors';
import { formatDateHuman } from '@/utils/format';
import { API_BASE_URL } from '@/config';
import type { MessagesStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<MessagesStackParamList, 'MessagesHome'>;

const POLL_INTERVAL_MS = 10000;

export default function ChatsListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? 0;
  const isAuthed = !!token && !!user?.full_name;
  const openGate = useAuthGateStore((s) => s.open);
  const c = useThemeColors();

  const styles = useStyles((cc) => ({
    list: { flexGrow: 1 },
    card: {
      flexDirection: 'row' as const,
      padding: spacing.md,
      backgroundColor: cc.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: cc.outline,
    },
    thumb: {
      width: 56, height: 56, borderRadius: radii.md,
      backgroundColor: cc.surfaceVariant,
      marginRight: spacing.md,
    },
    thumbPlaceholder: {
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    body: { flex: 1 },
    topRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
    name: { fontSize: 15, fontWeight: '700' as const, color: cc.onSurface, flex: 1 },
    time: { fontSize: 12, color: cc.muted, marginLeft: spacing.sm },
    hallLine: { fontSize: 12, color: cc.muted, marginTop: 2 },
    previewRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const,
      marginTop: 4,
    },
    previewIcon: { marginRight: 4 },
    preview: { fontSize: 13, color: cc.onSurfaceVariant, flex: 1 },
    previewUnread: { color: cc.onSurface, fontWeight: '600' as const },

    guestWrap: {
      flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const,
      padding: spacing.lg,
    },
    guestTitle: { fontSize: 18, fontWeight: '700' as const, color: cc.onSurface, textAlign: 'center' as const },
    guestSubtitle: {
      fontSize: 14, color: cc.muted, textAlign: 'center' as const,
      marginTop: spacing.sm, marginBottom: spacing.lg,
    },
    guestBtn: { minWidth: 200 },
  }));

  const [items, setItems] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(isAuthed);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (background = false) => {
    if (!isAuthed) { setLoading(false); return; }
    if (!background) setError(null);
    try {
      const resp = await chatsApi.list();
      setItems(resp.items);
    } catch (e) {
      if (!background) setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthed, t]);

  useFocusEffect(useCallback(() => {
    load();
    if (!isAuthed) return;
    const id = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load, isAuthed]));

  const onRefresh = () => { setRefreshing(true); load(); };

  // Формат времени: если сегодня — HH:MM, вчера — "Вчера", иначе — дата
  const formatTime = (iso: string | null): string => {
    if (!iso) return '';
    const date = iso.slice(0, 10);
    const time = iso.slice(11, 16);
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (date === today) return time;
    if (date === yesterday) return t('messages.yesterday');
    return formatDateHuman(date, lang);
  };

  if (!isAuthed) {
    return (
      <Screen>
        <View style={styles.guestWrap}>
          <Text style={styles.guestTitle}>{t('messages.guest_title')}</Text>
          <Text style={styles.guestSubtitle}>{t('messages.guest_subtitle')}</Text>
          <Button
            mode="contained"
            onPress={() => openGate('message')}
            style={styles.guestBtn}
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
        keyExtractor={(ch) => ch.guid}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
        ListEmptyComponent={
          !error ? (
            <EmptyState
              title={t('messages.empty_title')}
              subtitle={t('messages.empty_hint')}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const thumb = item.subject.main_thumb ? `${API_BASE_URL}${item.subject.main_thumb}` : null;
          const isUnreadForMe = item.unread_count > 0;
          const isMineLast = item.last_message_is_mine === true;
          const isReadBySome = item.last_message_read === true;

          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('Chat', { chatGuid: item.guid })}
            >
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Icon name="image-outline" size={28} color={c.muted} />
                </View>
              )}
              <View style={styles.body}>
                <View style={styles.topRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.other_user.name ?? '—'}
                  </Text>
                  <Text style={styles.time}>{formatTime(item.last_message_at)}</Text>
                </View>
                <Text style={styles.hallLine} numberOfLines={1}>
                  {item.subject.name ?? '—'}
                </Text>
                <View style={styles.previewRow}>
                  {/* Галочки только для своих сообщений (как в Krisha/WhatsApp) */}
                  {isMineLast ? (
                    <Icon
                      name={isReadBySome ? 'check-all' : 'check'}
                      size={14}
                      color={isReadBySome ? c.primary : c.muted}
                      style={styles.previewIcon}
                    />
                  ) : null}
                  <Text
                    style={[styles.preview, isUnreadForMe ? styles.previewUnread : null]}
                    numberOfLines={1}
                  >
                    {item.last_message_preview ?? t('messages.no_messages_yet')}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
