import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Loader } from '@/components/Loader';
import { ErrorBanner } from '@/components/ErrorBanner';
import { authApi, profileApi, ApiError } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { useAuthGateStore, AuthGateReason } from '@/store/authGateStore';
import { radii, spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { useThemeColors } from '@/theme/useThemeColors';
import { formatKzPhoneDisplay, normalizeKzPhone } from '@/utils/phone';
import { useSafeBottomInset } from '@/utils/useSafeBottomInset';
import { KEYBOARD_TOOLBAR_ID } from '@/components/KeyboardToolbar';

type Step = 'phone' | 'otp' | 'profile';

/** Человеческие сообщения для каждого случая входа */
function reasonTitle(reason: AuthGateReason, t: (k: string) => string): string {
  switch (reason) {
    case 'book':         return t('auth_gate.reason_book');
    case 'favorite':     return t('auth_gate.reason_favorite');
    case 'review':       return t('auth_gate.reason_review');
    case 'message':      return t('auth_gate.reason_message');
    case 'create_venue': return t('auth_gate.reason_create_venue');
    case 'my_bookings':  return t('auth_gate.reason_my_bookings');
    default:             return t('auth_gate.reason_generic');
  }
}

export function AuthGateSheet() {
  const { t } = useTranslation();
  const c = useThemeColors();

  const visible = useAuthGateStore((s) => s.visible);
  const reason = useAuthGateStore((s) => s.reason);
  const close = useAuthGateStore((s) => s.close);
  const fireSuccess = useAuthGateStore((s) => s.fireSuccess);

  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState<Step>('phone');
  const [rawPhone, setRawPhone] = useState('+7');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const insets = useSafeAreaInsets();
  const safeBottom = useSafeBottomInset();

  const styles = useStyles((cc) => ({
    backdrop: {
      flex: 1,
      backgroundColor: cc.backdrop,
    },
    kavContainer: {
      flex: 1,
      justifyContent: 'flex-end' as const,
    },
    sheet: {
      backgroundColor: cc.background,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      padding: spacing.md,
      paddingBottom: spacing.xl + spacing.md + safeBottom,
      maxHeight: '90%' as const,
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: cc.outline,
      alignSelf: 'center' as const, marginBottom: spacing.md,
    },
    closeBtn: {
      position: 'absolute' as const,
      top: spacing.sm, right: spacing.sm,
      padding: spacing.sm, zIndex: 2,
    },
    title: { fontSize: 22, fontWeight: '700' as const, color: cc.onSurface },
    subtitle: { fontSize: 14, color: cc.muted, marginTop: 4, marginBottom: spacing.lg },
    input: {
      borderWidth: 1, borderColor: cc.outline, borderRadius: radii.sm,
      paddingHorizontal: spacing.md, paddingVertical: 12,
      fontSize: 16, color: cc.onSurface,
      backgroundColor: cc.surface, marginBottom: spacing.sm,
    },
    otpHint: { fontSize: 12, color: cc.muted, marginTop: 4, marginBottom: spacing.md },
    resendWrap: { alignItems: 'center' as const, marginTop: spacing.sm },
    resendBtn: { color: cc.primary, fontSize: 14 },
    resendWait: { color: cc.muted, fontSize: 13 },
    submit: { marginTop: spacing.md },
    backLink: {
      marginTop: spacing.md, alignSelf: 'center' as const,
      padding: spacing.sm,
    },
    backLinkText: { color: cc.primary, fontSize: 14 },
  }));

  // Сброс состояния при каждом новом открытии
  useEffect(() => {
    if (visible) {
      setStep('phone');
      setRawPhone('+7');
      setOtp('');
      setFullName('');
      setError(null);
      setLoading(false);
      setResendIn(0);
    }
  }, [visible]);

  // Таймер повторной отправки кода
  useEffect(() => {
    if (step === 'otp' && resendIn === 0 && !intervalRef.current) {
      // стартовать не здесь — стартуем при отправке OTP
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [step, resendIn]);

  // Автоматическое закрытие модалки убрано намеренно:
  // fireSuccess вызывается явно в verifyOtp / saveProfile в нужный момент.
  // Иначе useEffect мог срабатывать в середине flow (когда token уже есть,
  // а профиль только-только начал заполняться) и закрывать модалку преждевременно.

  const startResendTimer = () => {
    setResendIn(60);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setResendIn((v) => {
        if (v <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    console.log('[AuthGate] sendOtp clicked, rawPhone=', rawPhone);
    const phone = normalizeKzPhone(rawPhone);
    console.log('[AuthGate] normalized phone=', phone);
    if (!phone) { setError(t('auth.phone_invalid')); return; }
    setLoading(true);
    setError(null);
    try {
      console.log('[AuthGate] calling requestOtp...');
      await authApi.requestOtp(phone);
      console.log('[AuthGate] requestOtp OK, switching to otp step');
      setStep('otp');
      startResendTimer();
    } catch (e) {
      console.log('[AuthGate] requestOtp FAILED:', e);
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    console.log('[AuthGate] verifyOtp clicked, otp=', otp);
    if (otp.length !== 4) { setError(t('auth.otp_invalid')); return; }
    const phone = normalizeKzPhone(rawPhone);
    if (!phone) return;
    setLoading(true);
    setError(null);
    try {
      console.log('[AuthGate] calling verifyOtp API...');
      const res = await authApi.verifyOtp(phone, otp);
      console.log('[AuthGate] verifyOtp OK, user=', res.user);
      await useAuthStore.getState().setAuth(res.token, res.user);
      if (!res.user.full_name) {
        console.log('[AuthGate] no full_name, switching to profile step');
        setStep('profile');
      } else {
        console.log('[AuthGate] has full_name, firing success');
        fireSuccess();
      }
    } catch (e) {
      console.log('[AuthGate] verifyOtp FAILED:', e);
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!fullName.trim()) { setError(t('auth.fullname_required')); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await profileApi.patch({ full_name: fullName.trim() });
      await setUser(res.user);
      fireSuccess();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const onBackdropPress = () => {
    // Разрешаем закрыть в любой момент (кроме loading)
    if (loading) return;
    close();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      {/* Backdrop отдельно — независимо от KAV, занимает весь экран */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onBackdropPress}>
        <View style={styles.backdrop} />
      </Pressable>

      {/* KAV для самого sheet'а — он поднимается с клавиатурой.
          - На iOS: behavior="padding" сдвигает контент вверх
          - На Android: behavior="height" уменьшает высоту контейнера, sheet остаётся видимым */}
      <KeyboardAvoidingView
        style={styles.kavContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none"
      >
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <View style={styles.handle} />
            <Pressable style={styles.closeBtn} onPress={close} hitSlop={8}>
              <Icon name="close" size={22} color={c.muted} />
            </Pressable>

            {step === 'phone' ? (
              <>
                <Text style={styles.title}>{t('auth_gate.title')}</Text>
                <Text style={styles.subtitle}>{reasonTitle(reason, t)}</Text>
                <ErrorBanner message={error} />
                <TextInput
                  value={rawPhone}
                  onChangeText={(v) => setRawPhone(v)}
                  placeholder="+7 (___) ___-__-__"
                  placeholderTextColor={c.muted}
                  keyboardType="phone-pad"
                  inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
                  style={styles.input}
                  autoFocus
                />
                <Button
                  mode="contained"
                  onPress={sendOtp}
                  loading={loading}
                  disabled={loading}
                  style={styles.submit}
                >
                  {t('auth.phone_button')}
                </Button>
              </>
            ) : null}

            {step === 'otp' ? (
              <>
                <Text style={styles.title}>{t('auth.otp_title')}</Text>
                <Text style={styles.subtitle}>
                  {t('auth.otp_subtitle', { phone: formatKzPhoneDisplay(normalizeKzPhone(rawPhone) ?? '') })}
                </Text>
                <ErrorBanner message={error} />
                <TextInput
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000"
                  placeholderTextColor={c.muted}
                  keyboardType="number-pad"
                  inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
                  style={styles.input}
                  autoFocus
                  maxLength={4}
                />
                <Text style={styles.otpHint}>{t('auth.otp_hint')}</Text>
                <Button
                  mode="contained"
                  onPress={verifyOtp}
                  loading={loading}
                  disabled={loading || otp.length !== 4}
                >
                  {t('auth.otp_button')}
                </Button>
                <View style={styles.resendWrap}>
                  {resendIn > 0 ? (
                    <Text style={styles.resendWait}>
                      {t('auth.otp_resend_in', { sec: resendIn })}
                    </Text>
                  ) : (
                    <Pressable onPress={sendOtp}>
                      <Text style={styles.resendBtn}>{t('auth.otp_resend')}</Text>
                    </Pressable>
                  )}
                </View>
                <Pressable style={styles.backLink} onPress={() => setStep('phone')}>
                  <Text style={styles.backLinkText}>{t('common.back')}</Text>
                </Pressable>
              </>
            ) : null}

            {step === 'profile' ? (
              <>
                <Text style={styles.title}>{t('auth.profile_title')}</Text>
                <Text style={styles.subtitle}>{t('auth.profile_subtitle')}</Text>
                <ErrorBanner message={error} />
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t('auth.full_name_placeholder')}
                  placeholderTextColor={c.muted}
                  style={styles.input}
                  autoFocus
                />
                <Button
                  mode="contained"
                  onPress={saveProfile}
                  loading={loading}
                  disabled={loading || !fullName.trim()}
                  style={styles.submit}
                >
                  {t('auth.profile_save')}
                </Button>
              </>
            ) : null}

            {loading && step !== 'phone' && step !== 'otp' && step !== 'profile' ? (
              <Loader />
            ) : null}
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
