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

export function CategoryBar({ categories, selectedId, onSelect }: Props) {
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');
  const c = useThemeColors();
  const styles = useStyles((cc) => ({
    wrap: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    item: {
      alignItems: 'center' as const,
      marginHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: cc.surface,
      borderWidth: 1,
      borderColor: cc.outline,
      minWidth: 76,
    },
    itemActive: {
      backgroundColor: cc.primaryContainer,
      borderColor: cc.primary,
    },
    label: { fontSize: 12, color: cc.onSurface, marginTop: 4 },
    labelActive: { color: cc.primary, fontWeight: '700' as const },
  }));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.wrap}
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
              size={22}
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
