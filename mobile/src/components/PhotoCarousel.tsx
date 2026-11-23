import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Category } from '@/lib/types';
import { photoUrl } from '@/lib/api';
import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { CategoryIcon } from './Cards';

/**
 * Swipe through a place's photos. It fills its parent (the HeroHeader), so the hero's scrim and
 * text sit on top of it. With no photos: navy ground with the category icon.
 */
export function PhotoCarousel({
  photos,
  category,
  height,
}: {
  photos: { url: string }[];
  category: Category;
  height: number;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <View style={[styles.placeholder, { width, height }]}>
        <CategoryIcon category={category} size={56} color="rgba(255,255,255,0.5)" />
        <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {t('place.noPhotos')}
        </AppText>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {photos.map((p) => (
          <Image
            key={p.url}
            source={{ uri: photoUrl(p.url) }}
            style={{ width, height }}
            contentFit="cover"
            transition={200}
          />
        ))}
      </ScrollView>
      {photos.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {photos.map((p, i) => (
            <View key={p.url} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
  },
  // Above the content sheet, which overlaps the hero by 24 px.
  dots: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    flexDirection: 'row',
    gap: spacing(1.5),
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
});
