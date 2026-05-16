import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { radii, spacing } from '@/theme';
import { useThemeColors } from '@/theme/useThemeColors';
import { useSafeBottomInset } from '@/utils/useSafeBottomInset';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomModal({ visible, onClose, children }: Props) {
  const colors = useThemeColors();
  const safeBottom = useSafeBottomInset();
  const bottomPadding = spacing.lg + safeBottom;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent={false}
    >
      {/* Backdrop отдельно — независимо от KAV, на весь экран */}
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }]}
        onPress={onClose}
      />

      {/* KAV для sheet'а — поднимается с клавиатурой.
          Внутрь ScrollView НЕ заворачиваем: дети могут содержать FlatList
          (например, список городов в CityPicker), а вложение ScrollView+FlatList
          одной ориентации запрещено в React Native. */}
      <KeyboardAvoidingView
        style={styles.kavContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: bottomPadding },
          ]}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kavContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.md,
    maxHeight: '85%',
  },
});
