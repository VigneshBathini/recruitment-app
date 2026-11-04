import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function ModuleScreen() {
  const theme = useTheme();
  const { title } = useLocalSearchParams<{ title?: string }>();
  return <ThemedView style={styles.screen}><View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
    <ThemedText style={styles.title}>{title ?? 'Recruitment module'}</ThemedText>
    <ThemedText style={[styles.body, { color: theme.textSecondary }]}>This module is enabled for your role. Its workspace will appear here when its workflow is available.</ThemedText>
    <Pressable onPress={() => router.back()}><ThemedText style={{ color: theme.primary, fontWeight: '700' }}>Back to dashboard</ThemedText></Pressable>
  </View></ThemedView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, padding: 20, justifyContent: 'center' }, card: { maxWidth: 560, width: '100%', alignSelf: 'center', borderWidth: 1, borderRadius: 18, padding: 24, gap: 14 }, title: { fontSize: 24, fontWeight: '800' }, body: { fontSize: 14, lineHeight: 21 } });
