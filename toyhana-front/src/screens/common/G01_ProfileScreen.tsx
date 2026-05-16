import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Divider, List, SegmentedButtons } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/Screen';
import { profileApi } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { useAuthGateStore } from '@/store/authGateStore';
import { useThemeStore, ThemeMode } from '@/store/themeStore';
import { useStyles } from '@/theme/useStyles';
import { spacing } from '@/theme';
import { formatKzPhoneDisplay } from '@/utils/phone';
import { setAppLanguage } from '@/i18n';
import i18n from '@/i18n';
import type { ProfileStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

export default function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const openAuthGate = useAuthGateStore((s) => s.open);
  const currentLang = (i18n.language === 'kz' ? 'kz' : 'ru') as 'ru' | 'kz';

  const [saving, setSaving] = useState(false);

  const isAuthed = !!token && !!user?.full_name;

  const styles = useStyles((c) => ({
    header: { marginBottom: spacing.md, marginTop: spacing.md },
    name: { fontSize: 22, fontWeight: '700' as const, color: c.onSurface },
    phone: { fontSize: 14, color: c.muted, marginTop: spacing.xs },

    guestCard: {
      marginTop: spacing.md, marginBottom: spacing.lg,
    },
    guestTitle: { fontSize: 22, fontWeight: '700' as const, color: c.onSurface },
    guestSubtitle: {
      fontSize: 14, color: c.muted,
      marginTop: spacing.sm, marginBottom: spacing.md,
    },
    guestBtn: {},

    sectionTitle: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: c.muted,
      textTransform: 'uppercase' as const,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    segments: { marginBottom: spacing.md },
    logoutBtn: { marginTop: spacing.lg, borderColor: c.error },
  }));

  const changeLanguageUser = async (next: 'ru' | 'kz') => {
    if (!isAuthed) {
      // Гость — меняем только локально
      setAppLanguage(next);
      return;
    }
    if (!user || user.language === next) return;
    setSaving(true);
    try {
      const res = await profileApi.patch({ language: next });
      await setUser(res.user);
      setAppLanguage(next);
    } catch { /* игнор */ } finally { setSaving(false); }
  };

  return (
    <Screen scroll>
      {isAuthed && user ? (
        <View style={styles.header}>
          <Text style={styles.name}>{user.full_name}</Text>
          <Text style={styles.phone}>{formatKzPhoneDisplay(user.phone)}</Text>
        </View>
      ) : (
        <View style={styles.guestCard}>
          <Text style={styles.guestTitle}>{t('auth_gate.title')}</Text>
          <Text style={styles.guestSubtitle}>{t('profile.guest_subtitle')}</Text>
          <Button
            mode="contained"
            onPress={() => openAuthGate('generic')}
            style={styles.guestBtn}
          >
            {t('profile.login')}
          </Button>
        </View>
      )}

      <Divider />

      <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
      <SegmentedButtons
        value={isAuthed ? (user?.language ?? currentLang) : currentLang}
        onValueChange={(v) => changeLanguageUser(v as 'ru' | 'kz')}
        buttons={[
          { value: 'ru', label: t('auth.language_ru'), disabled: saving },
          { value: 'kz', label: t('auth.language_kz'), disabled: saving },
        ]}
        style={styles.segments}
      />

      <Text style={styles.sectionTitle}>{t('profile.theme')}</Text>
      <SegmentedButtons
        value={themeMode}
        onValueChange={(v) => setThemeMode(v as ThemeMode)}
        buttons={[
          { value: 'system', label: t('profile.theme_system') },
          { value: 'light', label: t('profile.theme_light') },
          { value: 'dark', label: t('profile.theme_dark') },
        ]}
        style={styles.segments}
      />

      {isAuthed ? (
        <>
          <Divider />
          <List.Item
            title={t('profile.my_venues')}
            left={(p) => <List.Icon {...p} icon="domain" />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => navigation.navigate('MyVenues')}
          />
          <Divider />
          <List.Item
            title={t('profile.my_providers')}
            left={(p) => <List.Icon {...p} icon="account-star-outline" />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => navigation.navigate('MyProviders')}
          />
          <Divider />
          <List.Item
            title={t('profile.incoming_bookings')}
            left={(p) => <List.Icon {...p} icon="inbox-arrow-down-outline" />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => navigation.navigate('IncomingBookings')}
          />
          <Divider />
          <List.Item
            title={t('profile.my_bookings')}
            left={(p) => <List.Icon {...p} icon="calendar-check-outline" />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => navigation.navigate('MyBookings')}
          />

          <View style={{ flex: 1 }} />

          <Button
            mode="outlined"
            onPress={logout}
            style={styles.logoutBtn}
          >
            {t('profile.logout')}
          </Button>
        </>
      ) : null}
    </Screen>
  );
}
