import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Chip, Switch, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';

import { Screen } from '@/components/Screen';
import { Loader } from '@/components/Loader';
import { ErrorBanner } from '@/components/ErrorBanner';

import { dictsApi, ownerHallsApi, ApiError } from '@/api';
import type { Amenity, HallPhoto } from '@/api/types';
import type { OwnerHallFull } from '@/api';
import { API_BASE_URL } from '@/config';
import { dictName } from '@/utils/i18nDict';
import { useAuthStore } from '@/store/authStore';
import { radii, spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { useThemeColors } from '@/theme/useThemeColors';
import type { ProfileStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KEYBOARD_TOOLBAR_ID } from '@/components/KeyboardToolbar';

type Props = NativeStackScreenProps<ProfileStackParamList, 'HallForm'>;

export default function HallFormScreen({ route, navigation }: Props) {
  const styles = useStyles((c) => ({
  label: {
    fontSize: 13, fontWeight: '600', color: c.muted,
    textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm,
  },
  hint: { fontSize: 12, color: c.muted, marginBottom: spacing.sm },
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
  const { venueGuid, hallGuid } = route.params;
  const isEdit = !!hallGuid;

  const [amenitiesAll, setAmenitiesAll] = useState<Amenity[]>([]);
  const [hall, setHall] = useState<OwnerHallFull | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [capMin, setCapMin] = useState('');
  const [capMax, setCapMax] = useState('');
  const [priceWeekday, setPriceWeekday] = useState('');
  const [priceWeekend, setPriceWeekend] = useState('');
  const [amenityIds, setAmenityIds] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, h] = await Promise.all([
          dictsApi.amenities(),
          hallGuid ? ownerHallsApi.get(hallGuid) : Promise.resolve(null),
        ]);
        setAmenitiesAll(a.items);
        if (h) {
          const v = h.hall;
          setHall(v);
          setName(v.name);
          setDescription(v.description ?? '');
          setAreaSqm(v.area_sqm != null ? String(v.area_sqm) : '');
          setCapMin(v.capacity_min != null ? String(v.capacity_min) : '');
          setCapMax(v.capacity_max != null ? String(v.capacity_max) : '');
          setPriceWeekday(String(v.price_weekday));
          setPriceWeekend(String(v.price_weekend));
          setAmenityIds(v.amenities.map((x) => x.id));
          setIsActive(v.is_active);
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : t('common.error_generic'));
      } finally {
        setLoading(false);
      }
    })();
  }, [hallGuid, t]);

  const toggleAmenity = (id: number) => {
    setAmenityIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const intOrNull = (s: string) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };

  const submit = async () => {
    if (!name.trim()) { setError('Укажите название'); return; }
    const pw = parseInt(priceWeekday, 10);
    const pwe = parseInt(priceWeekend, 10);
    if (!Number.isFinite(pw) || pw < 0) { setError(t('owner.price_weekday_label')); return; }
    if (!Number.isFinite(pwe) || pwe < 0) { setError(t('owner.price_weekend_label')); return; }

    setSaving(true);
    setError(null);
    try {
      if (isEdit && hall) {
        const res = await ownerHallsApi.patch(hall.guid, {
          name: name.trim(),
          description: description.trim() || null,
          area_sqm: intOrNull(areaSqm),
          capacity_min: intOrNull(capMin),
          capacity_max: intOrNull(capMax),
          price_weekday: pw,
          price_weekend: pwe,
          amenity_ids: amenityIds,
          is_active: isActive,
        });
        setHall(res.hall);
      } else {
        const res = await ownerHallsApi.create({
          venue_guid: venueGuid,
          name: name.trim(),
          description: description.trim() || null,
          area_sqm: intOrNull(areaSqm),
          capacity_min: intOrNull(capMin),
          capacity_max: intOrNull(capMax),
          price_weekday: pw,
          price_weekend: pwe,
          amenity_ids: amenityIds,
        });
        // Переходим в режим редактирования — обновляем params, чтобы появился блок фото
        setHall(res.hall);
        navigation.setParams({ hallGuid: res.hall.guid });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setSaving(false);
    }
  };

  const addPhotos = async () => {
    if (!hall) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Нет доступа к фото');
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 20,
    });
    if (pick.canceled) return;

    const files = pick.assets.map((a, i) => ({
      uri: a.uri,
      name: a.fileName ?? `photo_${Date.now()}_${i}.jpg`,
      type: a.mimeType ?? 'image/jpeg',
    }));

    setUploadingPhotos(true);
    setError(null);
    try {
      const res = await ownerHallsApi.uploadPhotos(hall.guid, files);
      // Обновляем список фото локально
      setHall({
        ...hall,
        photos: [...hall.photos, ...res.items as HallPhoto[]],
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setUploadingPhotos(false);
    }
  };

  const deletePhoto = (photoId: number) => {
    Alert.alert(
      t('owner.delete_photo_title'),
      '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (!hall) return;
            try {
              await ownerHallsApi.deletePhoto(photoId);
              setHall({ ...hall, photos: hall.photos.filter((p) => p.id !== photoId) });
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t('common.error_generic'));
            }
          },
        },
      ],
    );
  };

  const remove = () => {
    if (!hall) return;
    Alert.alert(
      t('owner.delete_hall_confirm_title'),
      t('owner.delete_hall_confirm_text'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await ownerHallsApi.remove(hall.guid);
              navigation.goBack();
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t('common.error_generic'));
            }
          },
        },
      ],
    );
  };

  if (loading) return <Screen><Loader /></Screen>;

  return (
    <Screen scroll>
      <ErrorBanner message={error} />

      <Text style={styles.label}>{t('owner.hall_name_label')}</Text>
      <TextInput
        mode="outlined"
        value={name}
        onChangeText={setName}
        placeholder={t('owner.hall_name_placeholder')}
        style={styles.input}
      />

      <Text style={styles.label}>{t('owner.hall_description_label')}</Text>
      <TextInput
        mode="outlined"
        value={description}
        onChangeText={setDescription}
        placeholder={t('owner.hall_description_placeholder')}
        multiline
        numberOfLines={3}
        style={[styles.input, { minHeight: 80 }]}
      />

      <Text style={styles.label}>{t('owner.area_sqm_label')}</Text>
      <TextInput
        mode="outlined"
        keyboardType="number-pad"
        inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
        value={areaSqm}
        onChangeText={(v) => setAreaSqm(v.replace(/\D/g, '').slice(0, 5))}
        style={styles.input}
      />

      <Text style={styles.label}>{t('owner.capacity_label')}</Text>
      <View style={styles.row}>
        <TextInput
          mode="outlined"
          keyboardType="number-pad"
          inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
          value={capMin}
          onChangeText={(v) => setCapMin(v.replace(/\D/g, '').slice(0, 5))}
          placeholder={t('owner.capacity_min_placeholder')}
          style={[styles.input, styles.halfInput]}
        />
        <TextInput
          mode="outlined"
          keyboardType="number-pad"
          inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
          value={capMax}
          onChangeText={(v) => setCapMax(v.replace(/\D/g, '').slice(0, 5))}
          placeholder={t('owner.capacity_max_placeholder')}
          style={[styles.input, styles.halfInput]}
        />
      </View>

      <Text style={styles.label}>{t('owner.price_weekday_label')}</Text>
      <TextInput
        mode="outlined"
        keyboardType="number-pad"
        inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
        value={priceWeekday}
        onChangeText={(v) => setPriceWeekday(v.replace(/\D/g, '').slice(0, 10))}
        placeholder="200000"
        style={styles.input}
      />

      <Text style={styles.label}>{t('owner.price_weekend_label')}</Text>
      <TextInput
        mode="outlined"
        keyboardType="number-pad"
        inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
        value={priceWeekend}
        onChangeText={(v) => setPriceWeekend(v.replace(/\D/g, '').slice(0, 10))}
        placeholder="400000"
        style={styles.input}
      />

      <Text style={styles.label}>{t('owner.amenities_label')}</Text>
      <View style={styles.chips}>
        {amenitiesAll.map((a) => (
          <Chip
            key={a.id}
            selected={amenityIds.includes(a.id)}
            showSelectedOverlay
            onPress={() => toggleAmenity(a.id)}
            style={styles.chip}
          >
            {dictName(a, lang)}
          </Chip>
        ))}
      </View>

      {isEdit && hall ? (
        <View style={styles.activeRow}>
          <Text style={styles.activeLabel}>{t('owner.is_active_label')}</Text>
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

      {/* Блок фото — только после того, как зал уже создан */}
      <View style={styles.photoSection}>
        <View style={styles.photoHeader}>
          <Text style={styles.label}>{t('owner.photos_label')}</Text>
          {hall ? (
            <Button
              mode="text"
              icon="plus"
              onPress={addPhotos}
              loading={uploadingPhotos}
              disabled={uploadingPhotos || (hall.photos.length >= 20)}
            >
              {t('owner.add_photos')}
            </Button>
          ) : null}
        </View>
        {!hall ? (
          <Text style={styles.hint}>{t('owner.save_first_hint')}</Text>
        ) : (
          <>
            <Text style={styles.hint}>{t('owner.photos_hint')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
              {hall.photos.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.photoItem}
                  onLongPress={() => deletePhoto(p.id)}
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
            </ScrollView>
          </>
        )}
      </View>

      {isEdit ? (
        <Button
          mode="outlined"
          onPress={remove}
          textColor={colors.error}
          style={styles.deleteBtn}
        >
          {t('owner.delete_hall')}
        </Button>
      ) : null}
    </Screen>
  );
}

