import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Divider } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CommonActions } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Loader } from '@/components/Loader';
import { ErrorBanner } from '@/components/ErrorBanner';
import { PhotoGallery } from '@/components/PhotoGallery';
import { StarRating } from '@/components/StarRating';

import { providersApi, reviewsApi, chatsApi, ApiError } from '@/api';
import type { PublicProviderDetails, ReviewsResponse } from '@/api/types';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useRequireAuth } from '@/store/useRequireAuth';
import { useAuthStore } from '@/store/authStore';
import { radii, spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { useThemeColors } from '@/theme/useThemeColors';
import { formatDateHuman, formatPrice } from '@/utils/format';
import { dictName } from '@/utils/i18nDict';
import type { SearchStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<SearchStackParamList, 'ProviderDetails'>;

export default function ProviderDetailsScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { providerGuid } = route.params;
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');
  const c = useThemeColors();

  const styles = useStyles((cc) => ({
    photoRow: { position: 'relative' as const },
    favBtn: {
      position: 'absolute' as const,
      top: spacing.md,
      right: spacing.md,
      padding: 8,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: radii.pill,
    },
    body: { padding: spacing.md },
    title: { fontSize: 22, fontWeight: '700' as const, color: cc.onSurface },
    sub: { fontSize: 14, color: cc.muted, marginTop: 4 },
    metaRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, marginTop: spacing.md },
    chip: { marginRight: spacing.sm, marginBottom: spacing.sm },
    priceBox: {
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: cc.surfaceVariant,
      borderRadius: radii.md,
    },
    priceRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, paddingVertical: 4 },
    priceLabel: { fontSize: 14, color: cc.onSurface },
    priceValue: { fontSize: 16, fontWeight: '700' as const, color: cc.primary },
    sectionTitle: {
      fontSize: 13, fontWeight: '700' as const, color: cc.muted,
      textTransform: 'uppercase' as const,
      marginTop: spacing.lg, marginBottom: spacing.sm,
    },
    paragraph: { fontSize: 14, color: cc.onSurface, lineHeight: 20 },
    wrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
    mapBtn: { marginTop: spacing.sm, alignSelf: 'flex-start' as const },
    muted: { fontSize: 14, color: cc.muted },
    reviewItem: { marginBottom: spacing.sm },
    reviewHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
    reviewName: { fontWeight: '600' as const, color: cc.onSurface },
    reviewText: { fontSize: 14, color: cc.onSurface, marginTop: 4 },
    reviewDate: { fontSize: 12, color: cc.muted, marginTop: 4 },
    reply: {
      marginTop: spacing.sm, padding: spacing.sm,
      backgroundColor: cc.surfaceVariant, borderRadius: radii.sm,
    },
    replyLabel: { fontSize: 12, fontWeight: '600' as const, color: cc.muted, marginBottom: 2 },
    replyText: { fontSize: 13, color: cc.onSurface },
    footer: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: cc.outline,
      backgroundColor: cc.background,
    },
    bookBtn: { flex: 2, paddingVertical: spacing.xs },
    chatBtn: { flex: 1, paddingVertical: spacing.xs },
  }));

  const [provider, setProvider] = useState<PublicProviderDetails | null>(null);
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isFav = useFavoritesStore((s) => s.guids.has(providerGuid));
  const toggleProviderFav = useFavoritesStore((s) => s.toggleProvider);
  const requireAuth = useRequireAuth();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [pResp, rResp] = await Promise.all([
          providersApi.getPublic(providerGuid),
          reviewsApi.listProvider(providerGuid),
        ]);
        setProvider(pResp.provider);
        setReviews(rResp);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : t('common.error_generic'));
      } finally {
        setLoading(false);
      }
    })();
  }, [providerGuid, t]);

  const openIn2Gis = () => {
    if (!provider?.latitude || !provider?.longitude) return;
    const url = `dgis://2gis.ru/routeSearch/rsType/car/to/${provider.longitude},${provider.latitude}`;
    Linking.openURL(url).catch(() => {});
  };

  if (loading) return <Screen><Loader /></Screen>;
  if (error || !provider) {
    return (
      <Screen>
        <ErrorBanner message={error ?? t('common.error_generic')} />
      </Screen>
    );
  }

  const unitLabel = provider.price_unit ? t(`provider.unit_${provider.price_unit}`) : '';

  return (
    <Screen padded={false} scroll>
      <View style={styles.photoRow}>
        <PhotoGallery photos={provider.photos} />
        <Pressable
          style={styles.favBtn}
          onPress={() => requireAuth('favorite', () => toggleProviderFav(provider.guid, !isFav))}
          hitSlop={8}
        >
          <Icon
            name={isFav ? 'heart' : 'heart-outline'}
            size={26}
            color={isFav ? c.primary : '#FFFFFF'}
          />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{provider.name}</Text>
        <Text style={styles.sub}>
          {dictName(provider.category, lang)} · {dictName(provider.city, lang)}
        </Text>

        {reviews && reviews.reviews_count > 0 ? (
          <View style={styles.metaRow}>
            <Chip icon="star" style={styles.chip}>
              {reviews.avg_rating.toFixed(1)} · {reviews.reviews_count}
            </Chip>
          </View>
        ) : null}

        <View style={styles.priceBox}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              {provider.price_from != null
                ? t('provider.price_from_prefix')
                : t('provider.price_negotiable')}
              {unitLabel ? ` · ${unitLabel}` : ''}
            </Text>
            <Text style={styles.priceValue}>
              {provider.price_from != null ? formatPrice(provider.price_from) : '—'}
            </Text>
          </View>
        </View>

        {provider.description ? (
          <>
            <Text style={styles.sectionTitle}>{t('hall.description')}</Text>
            <Text style={styles.paragraph}>{provider.description}</Text>
          </>
        ) : null}

        {provider.attrs.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{t('provider.attrs_label')}</Text>
            <View style={styles.wrap}>
              {provider.attrs.map((a) => (
                <Chip key={a.id} style={styles.chip}>{dictName(a, lang)}</Chip>
              ))}
            </View>
          </>
        ) : null}

        {provider.phone ? (
          <>
            <Text style={styles.sectionTitle}>{t('provider.contact_label')}</Text>
            <Button
              mode="outlined"
              icon="phone"
              style={styles.mapBtn}
              onPress={() => Linking.openURL(`tel:${provider.phone}`).catch(() => {})}
            >
              {provider.phone}
            </Button>
          </>
        ) : null}

        {provider.latitude && provider.longitude ? (
          <Button mode="outlined" icon="map" style={styles.mapBtn} onPress={openIn2Gis}>
            {t('hall.open_in_2gis')}
          </Button>
        ) : null}

        <Text style={styles.sectionTitle}>{t('hall.reviews')}</Text>
        {reviews && reviews.items.length > 0 ? (
          reviews.items.map((r) => (
            <View key={r.id} style={styles.reviewItem}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewName}>{r.client_name}</Text>
                <StarRating value={r.rating} readOnly size={14} />
              </View>
              {r.text ? <Text style={styles.reviewText}>{r.text}</Text> : null}
              {r.owner_reply ? (
                <View style={styles.reply}>
                  <Text style={styles.replyLabel}>{t('provider.owner_reply_label')}</Text>
                  <Text style={styles.replyText}>{r.owner_reply}</Text>
                </View>
              ) : null}
              <Text style={styles.reviewDate}>
                {formatDateHuman(r.created_at.slice(0, 10), lang)}
              </Text>
              <Divider style={{ marginTop: spacing.md }} />
            </View>
          ))
        ) : (
          <Text style={styles.muted}>{t('hall.no_reviews')}</Text>
        )}
      </View>

      <View style={styles.footer}>
        <Button
          mode="outlined"
          icon="chat-outline"
          style={styles.chatBtn}
          onPress={() => requireAuth('message', async () => {
            try {
              const res = await chatsApi.openWithProvider(provider.guid);
              navigation.getParent()?.dispatch(
                CommonActions.navigate({
                  name: 'Messages',
                  params: { screen: 'Chat', params: { chatGuid: res.chat_guid } },
                }),
              );
            } catch { /* ignore */ }
          })}
        >
          {t('hall.chat_button')}
        </Button>
        <Button
          mode="contained"
          style={styles.bookBtn}
          onPress={() =>
            requireAuth('book', () =>
              navigation.navigate('BookingForm', { providerGuid: provider.guid }))
          }
        >
          {t('hall.book_button')}
        </Button>
      </View>
    </Screen>
  );
}
