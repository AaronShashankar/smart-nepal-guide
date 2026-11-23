import { router, type Href } from 'expo-router';
import { Pressable, type PressableProps } from 'react-native';

/**
 * A Pressable that opens `href`. Use it instead of <Link asChild><Pressable>: Link's Slot throws
 * on an array style in development and drops a `({ pressed }) => …` style, so cards lose their
 * look and press feedback. This keeps any Pressable style.
 */
export function PressableLink({
  href,
  ...props
}: Omit<PressableProps, 'onPress'> & { href: Href }) {
  return <Pressable accessibilityRole="link" onPress={() => router.push(href)} {...props} />;
}
