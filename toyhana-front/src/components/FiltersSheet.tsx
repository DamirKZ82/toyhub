import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, Chip, TextInput, SegmentedButtons } from 'react-native-paper';

import { BottomModal } from './BottomModal';
import { spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { dictName } from '@/utils/i18nDict';
import { useAuthStore } from '@/store/authStore';
import type { Amenity } from '@/api/types';
import { KEYBOARD_TOOLBAR_ID } from '@/components/KeyboardToolbar';

export type SortOption = 'rating_desc' | 'price_asc' | 'price_desc';

interface Value {
  priceMax: number | null;
  amenityIds: number[];
  sort: SortOption;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  value: Value;
  onApply: (v: Value) => void;
  /** Список фильтруемых тегов: удобства зала ИЛИ атрибуты исполнителя. */
  amenities: Amenity[];
  /** Заголовок секции тегов (по умолчанию — "Удобства"). */
  amenitiesLabel?: string;
}

export function FiltersSheet({
  visible, onClose, value, onApply, amenities, amenitiesLabel,
}: Props) {
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');
  const [priceMax, setPriceMax] = useState(value.priceMax ? String(value.priceMax) : '');
  const [amenityIds, setAmenityIds] = useState<number[]>(value.amenityIds);
  const [sort, setSort] = useState<SortOption>(value.sort);

  const styles = useStyles((c) => ({
    title: { fontSize: 18, fontWeight: '700' as const, color: c.onSurface, marginBottom: spacing.md },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: c.muted,
      textTransform: 'uppercase' as const,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    input: { backgroundColor: c.surface, marginBottom: spacing.sm },
    chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
    chip: { marginRight: spacing.sm, marginBottom: spacing.sm },
    actions: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      marginTop: spacing.lg,
    },
  }));

  useEffect(() => {
    if (visible) {
      setPriceMax(value.priceMax ? String(value.priceMax) : '');
      setAmenityIds(value.amenityIds);
      setSort(value.sort);
    }
  }, [visible, value]);

  const toggleAmenity = (id: number) => {
    setAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const apply = () => {
    const p = parseInt(priceMax, 10);
    onApply({
      priceMax: Number.isFinite(p) && p > 0 ? p : null,
      amenityIds,
      sort,
    });
    onClose();
  };

  const reset = () => {
    setPriceMax('');
    setAmenityIds([]);
    setSort('rating_desc');
  };

  return (
    <BottomModal visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Фильтры</Text>

        <Text style={styles.sectionLabel}>Максимальная цена</Text>
        <TextInput
          mode="outlined"
          keyboardType="number-pad"
          inputAccessoryViewID={KEYBOARD_TOOLBAR_ID}
          value={priceMax}
          onChangeText={(t) => setPriceMax(t.replace(/\D/g, '').slice(0, 10))}
          placeholder="500000"
          style={styles.input}
        />

        <Text style={styles.sectionLabel}>Сортировка</Text>
        <SegmentedButtons
          value={sort}
          onValueChange={(v) => setSort(v as SortOption)}
          buttons={[
            { value: 'rating_desc', label: 'Рейтинг' },
            { value: 'price_asc', label: 'Цена ↑' },
            { value: 'price_desc', label: 'Цена ↓' },
          ]}
          style={{ marginBottom: spacing.md }}
        />

        {amenities.length > 0 ? (
          <Text style={styles.sectionLabel}>{amenitiesLabel ?? 'Удобства'}</Text>
        ) : null}
        <View style={styles.chips}>
          {amenities.map((a) => {
            const selected = amenityIds.includes(a.id);
            return (
              <Chip
                key={a.id}
                selected={selected}
                showSelectedOverlay
                onPress={() => toggleAmenity(a.id)}
                style={styles.chip}
              >
                {dictName(a, lang)}
              </Chip>
            );
          })}
        </View>

        <View style={styles.actions}>
          <Button mode="text" onPress={reset}>Сбросить</Button>
          <Button mode="contained" onPress={apply}>Применить</Button>
        </View>
      </ScrollView>
    </BottomModal>
  );
}
