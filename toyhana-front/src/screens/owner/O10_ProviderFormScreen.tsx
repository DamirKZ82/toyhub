import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Chip, SegmentedButtons, Switch, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';

import { Screen } from '@/components/Screen';
import { Loader } from '@/components/Loader';
import { ErrorBanner } from '@/components/ErrorBanner';
import { CityPicker } from '@/components/CityPicker';
import { PhotoViewer } from '@/components/PhotoViewer';

import { dictsApi, providersApi, ApiError } from '@/api';
import type { OwnerProviderFull } from '@/api';
import type {
  Category, City, PriceUnit, ProviderAttrType,
} from '@/api/types';
import { API_BASE_URL } from '@/config';
import { dictName } from '@/utils/i18nDict';
import { useAuthStore } from '@/store/authStore';
import { radii, spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { useThemeColors } from '@/theme/useThemeColors';
import type { ProfileStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KEYBOARD_TOOLBAR_ID } from '@/components/KeyboardToolbar';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProviderForm'>;

const PRICE_UNITS: PriceUnit[] = ['event', 'hour', 'person', 'day'];
const PHOTO_LIMIT = 20;

interface LocalPhoto { uri: string; name: string; type: string }

export default function ProviderFormScreen({ route, navigation }: Props) {
  const styles = useStyles((c) => ({
    label: {
      fontSize: 13, fontWeight: '600', color: c.muted,
      textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm,
    },
    hint: { fontSize: 12, color: c.muted, marginBottom: spacing.sm },
    dropdown: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: c.outline, borderRadius: radii.sm,
      paddingHorizontal: spacing.md, paddingVertical: 14,
      backgroundColor: c.surface,
    },
    dropdownText: { marginLeft: spacing.sm, fontSize: 15, color: c.onSurface },
    placeholder: { color: c.muted },
    input: { backgroundColor: c.surface, marginBottom: spacing.xs },
    row: { flexDirection: 'row', gap: spacing.sm },
    halfInput: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap' },
    chip: { marginRight: spacing.sm, marginBottom: spacing.sm },
    activeRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    activeLabel: { fontSize: 15, color: c.onSurface },
    submit: { marginTop: spacing.md, paddingVertical: spacing.xs },
    photoSection: { marginTop: spacing.lg },
    photoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    photoList: { marginTop: spacing.sm },
    photoItem: { marginRight: spacing.sm, position: 'relative' },
    photoThumb: { width: 90, height: 90, borderRadius: radii.md, backgroundColor: c.surfaceVariant },
    photoDelete: {
      position: 'absolute', top: 4, right: 4,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center', justifyContent: 'center',
    },
    deleteBtn: { marginTop: spacing.lg, marginBottom: spacing.lg, borderColor: c.error },
  }));

  const colors = useThemeColors();
  const { t } = useTranslation();
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');
  const editingGuid = route.params.providerGuid;
  const isEdit = !!editingGuid;

  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [attrTypes, setAttrTypes] = useState<ProviderAttrType[]>([]);
  const [provider, setProvider] = useState<OwnerProviderFull | null>(null);

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('event');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [attrIds, setAttrIds] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Локально выбранные фото — заливаются на сервер только при сохранении.
  const [pendingPhotos, setPendingPhotos] = useState<LocalPhoto[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [cityOpen, setCityOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;

  useEffect(() => {
    (async () => {
      try {
        const [catsResp, citiesResp, p] = await Promise.all([
          dictsApi.categories(),
          dictsApi.cities(),
          editingGuid ? providersApi.get(editingGuid) : Promise.resolve(null),
        ]);
        // Категория restaurant управляется через venues/halls — здесь её не предлагаем
        setCategories(catsResp.items.filter((x) => x.code !== 'restaurant'));
        setCities(citiesResp.items);
        if (p) {
          const v = p.provider;
          setProvider(v);
          setCategoryId(v.category_id);
          setCity(citiesResp.items.find((ci) => ci.id === v.city_id) ?? null);
          setName(v.name);
          setDescription(v.description ?? '');
          setPhone(v.phone ?? '');
          setPriceFrom(v.price_from != null ? String(v.price_from) : '');
          setPriceUnit(v.price_unit ?? 'event');
          setLat(v.latitude != null ? String(v.latitude) : '');
          setLng(v.longitude != null ? String(v.longitude) : '');
          setAttrIds(v.attrs.map((a) => a.id));
          setIsActive(v.is_active);
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : t('common.error_generic'));
      } finally {
        setLoading(false);
      }
    })();
  }, [editingGuid, t]);

  // Атрибуты — при смене категории
  useEffect(() => {
    if (!selectedCategory) { setAttrTypes([]); return; }
    (async () => {
      try {
        const r = await dictsApi.providerAttrTypes(selectedCategory.code);
        setAttrTypes(r.items);
        // Уберём выбранные атрибуты, которых нет в новой категории
        setAttrIds((prev) => prev.filter((id) => r.items.some((a) => a.id === id)));
      } catch { setAttrTypes([]); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory?.id]);

  const toggleAttr = (id: number) => {
    setAttrIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const numOrNull = (s: string) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };
  const floatOrNull = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const submit = async () => {
    if (!categoryId) { setError(t('owner.provider_category_placeholder')); return; }
    if (!city) { setError(t('owner.venue_city_placeholder')); return; }
    if (!name.trim()) { setError(t('owner.provider_name_label')); return; }

    const body = {
      category_id: categoryId,
      city_id: city.id,
      name: name.trim(),
      description: description.trim() || null,
      phone: phone.trim() || null,
      latitude: floatOrNull(lat),
      longitude: floatOrNull(lng),
      price_from: numOrNull(priceFrom),
      price_unit: priceUnit,
      attr_ids: attrIds,
    };

    setSaving(true);
    setError(null);
    try {
      // 1) Создаём/обновляем карточку
      let guid: string;
      if (isEdit && provider) {
        const res = await providersApi.patch(provider.guid, { ...body, is_active: isActive });
        guid = res.provider.guid;
      } else {
        const res = await providersApi.create(body);
        guid = res.provider.guid;
      }
      // 2) Заливаем выбранные до сохранения фото
      if (pendingPhotos.length) {
        await providersApi.uploadPhotos(guid, pendingPhotos);
      }
      // 3) Успех → сообщение и возврат назад
      setPendingPhotos([]);
      Alert.alert(t('common.saved'), '', [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setSaving(false);
    }
  };

  const existingCount = provider?.photos.length ?? 0;

  const pickPhotos = async () => {
    if (existingCount + pendingPhotos.length >= PHOTO_LIMIT) {
      setError(t('owner.photos_limit', { limit: PHOTO_LIMIT }));
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(t('owner.no_photo_access')); return; }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: PHOTO_LIMIT,
    });
    if (pick.canceled) return;

    const room = PHOTO_LIMIT - existingCount - pendingPhotos.length;
    const files: LocalPhoto[] = pick.assets.slice(0, room).map((a, i) => ({
      uri: a.uri,
      name: a.fileName ?? `photo_${Date.now()}_${i}.jpg`,
      type: a.mimeType ?? 'image/jpeg',
    }));
    setError(null);
    setPendingPhotos((prev) => [...prev, ...files]);
  };

  const removePending = (idx: number) => {
    setPendingPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const deletePhoto = (photoId: number) => {
    Alert.alert(t('owner.delete_photo_title'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!provider) return;
          try {
            await providersApi.deletePhoto(photoId);
            setProvider({ ...provider, photos: provider.photos.filter((p) => p.id !== photoId) });
          } catch (e) {
            setError(e instanceof ApiError ? e.message : t('common.error_generic'));
          }
        },
      },
    ]);
  };

  const remove = () => {
    if (!provider) return;
    Alert.alert(
      t('owner.delete_provider_confirm_title'),
      t('owner.delete_provider_confirm_text'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await providersApi.remove(provider.guid);
              navigation.popToTop();
              navigation.navigate('MyProviders');
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t('common.error_generic'));
            }
          },
        },
      ],
    );
  };

  if (loading) return <Screen><Loader /></Screen>;

  const serverPhotos = provider?.photos ?? [];
  const galleryUris = [
    ...serverPhotos.map((p) => `${API_BASE_URL}${p.file_path}`),
    ...pendingPhotos.map((p) => p.uri),
  ];

  return (
    <Screen scroll>
      <ErrorBanner message={error} />

      <Text style={styles.label}>{t('owner.provider_category_label')}</Text>
      <View style={styles.chips}>
        {categories.map((cat) => (
          <Chip
            key={cat.id}
            selected={categoryId === cat.id}
            showSelectedOverlay
            onPress={() => setCategoryId(cat.id)}
            style={styles.chip}
          >
            {dictName(cat, lang)}
          </Chip>
        ))}
      </View>

      <Text style={styles.label}>{t('owner.venue_city_label')}</Text>
      <Pressable style={styles.dropdown} onPress={() => setCityOpen(true)}>
        <Icon name="map-marker" size={18} color={colors.muted} />
        <Text style={[styles.dropdownText, !city && styles.placeholder]}>
          {city ? dictName(city, lang) : t('owner.venue_city_placeholder')}
        </Text>
      </Pressable>

      <Text style={styles.label}>{t('owner.provider_name_label')}</Text>
      <TextInput
        mode="outlined"
        value={name}
        onChangeText={setName}
        placeholder={t('owner.provider_name_placeholder')}
        style={styles.input}
      />

      <Text style={styles.label}>{t('owner.provider_description_label')}</Text>
      <TextInput
        mode="outlined"
        value={description}
        onChangeText={setDescription}
        placeholder={t('owner.provider_description_placeholder')}
        multiline
        numberOfLines={3}
        style={[styles.input, { minHeight: 80 }]}
      />

      <Text style={styles.label}>{t('owner.provider_phone_label')}</Text>
      <TextInput
        mode="outlined"
        value={phone}
        onChangeText={setPhone}
        placeholder={t('owner.venue_phone_placeholder')}
        keyboardType="phone-pad"
        inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
        style={styles.input}
      />

      <Text style={styles.label}>{t('owner.provider_price_label')}</Text>
      <TextInput
        mode="outlined"
        keyboardType="number-pad"
        inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
        value={priceFrom}
        onChangeText={(v) => setPriceFrom(v.replace(/\D/g, '').slice(0, 10))}
        placeholder="50000"
        style={styles.input}
      />

      <Text style={styles.label}>{t('owner.provider_price_unit_label')}</Text>
      <SegmentedButtons
        value={priceUnit}
        onValueChange={(v) => setPriceUnit(v as PriceUnit)}
        buttons={PRICE_UNITS.map((u) => ({ value: u, label: t(`provider.unit_${u}`) }))}
        style={{ marginBottom: spacing.sm }}
      />

      {attrTypes.length > 0 ? (
        <>
          <Text style={styles.label}>{t('provider.attrs_label')}</Text>
          <View style={styles.chips}>
            {attrTypes.map((a) => (
              <Chip
                key={a.id}
                selected={attrIds.includes(a.id)}
                showSelectedOverlay
                onPress={() => toggleAttr(a.id)}
                style={styles.chip}
              >
                {dictName(a, lang)}
              </Chip>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.label}>{t('owner.coordinates_label')}</Text>
      <View style={styles.row}>
        <TextInput
          mode="outlined"
          value={lat}
          onChangeText={(v) => setLat(v.replace(/[^0-9.,\-]/g, ''))}
          placeholder={t('owner.latitude')}
          keyboardType="numbers-and-punctuation"
          style={[styles.input, styles.halfInput]}
        />
        <TextInput
          mode="outlined"
          value={lng}
          onChangeText={(v) => setLng(v.replace(/[^0-9.,\-]/g, ''))}
          placeholder={t('owner.longitude')}
          keyboardType="numbers-and-punctuation"
          style={[styles.input, styles.halfInput]}
        />
      </View>

      {isEdit && provider ? (
        <View style={styles.activeRow}>
          <Text style={styles.activeLabel}>{t('owner.provider_is_active_label')}</Text>
          <Switch value={isActive} onValueChange={setIsActive} color={colors.primary} />
        </View>
      ) : null}

      <Button
        mode="contained"
        onPress={submit}
        loading={saving}
        disabled={saving}
        style={styles.submit}
      >
        {t('common.save')}
      </Button>

      <View style={styles.photoSection}>
        <View style={styles.photoHeader}>
          <Text style={styles.label}>{t('owner.photos_label')}</Text>
          <Button
            mode="text"
            icon="plus"
            onPress={pickPhotos}
            disabled={serverPhotos.length + pendingPhotos.length >= PHOTO_LIMIT}
          >
            {t('owner.add_photos')}
          </Button>
        </View>
        <Text style={styles.hint}>{t('owner.photos_hint')}</Text>
        {galleryUris.length === 0 ? (
          <Text style={styles.hint}>{t('owner.photos_empty')}</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
            {serverPhotos.map((p, i) => (
              <Pressable
                key={`s-${p.id}`}
                style={styles.photoItem}
                onPress={() => { setViewerIndex(i); setViewerOpen(true); }}
              >
                <Image
                  source={{ uri: `${API_BASE_URL}${p.thumb_path}` }}
                  style={styles.photoThumb}
                />
                <Pressable style={styles.photoDelete} onPress={() => deletePhoto(p.id)} hitSlop={8}>
                  <Icon name="close" size={14} color="#FFF" />
                </Pressable>
              </Pressable>
            ))}
            {pendingPhotos.map((p, i) => (
              <Pressable
                key={`p-${p.uri}-${i}`}
                style={styles.photoItem}
                onPress={() => {
                  setViewerIndex(serverPhotos.length + i);
                  setViewerOpen(true);
                }}
              >
                <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                <Pressable
                  style={styles.photoDelete}
                  onPress={() => removePending(i)}
                  hitSlop={8}
                >
                  <Icon name="close" size={14} color="#FFF" />
                </Pressable>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {isEdit ? (
        <Button
          mode="outlined"
          onPress={remove}
          textColor={colors.error}
          style={styles.deleteBtn}
        >
          {t('owner.delete_provider')}
        </Button>
      ) : null}

      <CityPicker
        visible={cityOpen}
        cities={cities}
        onSelect={(cc) => setCity(cc)}
        onClose={() => setCityOpen(false)}
      />

      <PhotoViewer
        visible={viewerOpen}
        uris={galleryUris}
        initialIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </Screen>
  );
}
