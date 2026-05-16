import React from 'react';
import {
  Dimensions, FlatList, Image, Modal, Pressable, StyleSheet, View,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  /** Полные URI картинок (готовые к Image source.uri). */
  uris: string[];
  initialIndex?: number;
  onClose: () => void;
}

/** Полноэкранный просмотрщик фото со свайпом между кадрами. */
export function PhotoViewer({ visible, uris, initialIndex = 0, onClose }: Props) {
  const insets = useSafeAreaInsets();
  if (!uris.length) return null;
  const safeIndex = Math.min(Math.max(initialIndex, 0), uris.length - 1);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <FlatList
          data={uris}
          keyExtractor={(u, i) => `${u}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={safeIndex}
          getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
          renderItem={({ item }) => (
            <Pressable style={styles.page} onPress={onClose}>
              <Image source={{ uri: item }} style={styles.img} resizeMode="contain" />
            </Pressable>
          )}
        />
        <Pressable
          onPress={onClose}
          style={[styles.close, { top: insets.top + 8 }]}
          hitSlop={12}
        >
          <Icon name="close" size={28} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  page: { width: W, height: H, alignItems: 'center', justifyContent: 'center' },
  img: { width: W, height: H },
  close: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
