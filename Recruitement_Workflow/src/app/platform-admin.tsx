
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export default function PlatformAdminScreen() {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>
        Platform Admin Dashboard
      </Text>

      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Welcome to the Recruitment Workflow Platform.
      </Text>

      <Text style={[styles.status, { color: theme.primary }]}>
        Platform Admin login successful
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 24,
  },
});
