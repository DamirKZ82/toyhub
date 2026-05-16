import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import { radii, spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { useThemeColors } from '@/theme/useThemeColors';
import { dictName } from '@/utils/i18nDict';
import { useAuthStore } from '@/store/authStore';
import type { Category } from '@/api/types';

interface Props {
  categories: Category[];
  selectedId: number | null;
  onSelect: (cat: Category) => void;
}

// Фиксированная высота бара: горизонтальный ScrollView в flex-колонке
// иначе растягивается по вертикали на весь экран.
const BAR_HEIGHT = 66;

export function CategoryBar({ categories, selectedId, onSelect }: Props) {
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');
  const c = useThemeColors();
  const styles = useStyles((cc) => ({
    bar: { height: BAR_HEIGHT, flexGrow: 0 },
    content: {
      alignItems: 'center' as const,
      paddingHorizontal: spacing.sm,
    },
    item: {
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: cc.surface,
      borderWidth: 1,
      borderColor: cc.outline,
      minWidth: 64,
      height: 52,
    },
    itemActive: {
      backgroundColor: cc.primaryContainer,
      borderColor: cc.primary,
    },
    label: { fontSize: 11, color: cc.onSurface, marginTop: 3 },
    labelActive: { color: cc.primary, fontWeight: '700' as const },
  }));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.content}
    >
      {categories.map((cat) => {
        const active = cat.id === selectedId;
        return (
          <Pressable
            key={cat.id}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => onSelect(cat)}
          >
            <Icon
              name={(cat.icon as keyof typeof Icon.glyphMap) ?? 'shape-outline'}
              size={18}
              color={active ? c.primary : c.muted}
            />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {dictName(cat, lang)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
