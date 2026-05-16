import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { radii } from '@/theme';
import { useThemeColors } from '@/theme/useThemeColors';
import { API_BASE_URL } from '@/config';
import { PhotoViewer } from './PhotoViewer';
import type { HallPhoto } from '@/api/types';

const { width: SCREEN_W } = Dimensions.get('window');

export function PhotoGallery({ photos }: { photos: HallPhoto[] }) {
  const c = useThemeColors();
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const listRef = useRef<FlatList<HallPhoto>>(null);

  if (!photos.length) {
    return <View style={[styles.photo, { backgroundColor: c.surfaceVariant }]} />;
  }

  const uris = photos.map((p) => `${API_BASE_URL}${p.file_path}`);

  return (
    <View>
      <FlatList
        ref={listRef}
        data={photos}
        keyExtractor={(p) => String(p.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setIndex(i);
        }}
        renderItem={({ item, index: i }) => (
          <Pressable onPress={() => { setIndex(i); setViewerOpen(true); }}>
            <Image
              source={{ uri: `${API_BASE_URL}${item.file_path}` }}
              style={[styles.photo, { backgroundColor: c.surfaceVariant }]}
            />
          </Pressable>
        )}
      />
      <View style={styles.dotsWrap}>
        {photos.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === index ? styles.dotActive : null]}
          />
        ))}
      </View>
      <PhotoViewer
        visible={viewerOpen}
        uris={uris}
        initialIndex={index}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: SCREEN_W, aspectRatio: 16 / 10 },
  dotsWrap: {
    position: 'absolute',
    bottom: 10,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 6, height: 6, borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 3,
  },
  dotActive: { backgroundColor: '#FFFFFF', width: 18 },
});
