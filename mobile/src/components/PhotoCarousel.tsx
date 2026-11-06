import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Category } from '@/lib/types';
import { photoUrl } from '@/lib/api';
import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { CategoryIcon } from './Cards';

const HEIGHT = 240;

export function PhotoCarousel({
  photos,
  category,
}: {
  photos: { url: string }[];
  category: Category;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <View style={[styles.placeholder, { width }]}>
        <CategoryIcon category={category} size={48} />
        <AppText muted variant="caption">
          {t('place.noPhotos')}
        </AppText>
      </View>
    );
  }

  return (
    <View>
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
            style={{ width, height: HEIGHT }}
            contentFit="cover"
            transition={200}
          />
        ))}
      </ScrollView>
      {photos.length > 1 && (
        <View style={styles.dots}>
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
    height: HEIGHT * 0.6,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
  },
  dots: {
    position: 'absolute',
    bottom: spacing(2),
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing(1.5),
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ffffff88' },
  dotActive: { backgroundColor: '#fff' },
});
