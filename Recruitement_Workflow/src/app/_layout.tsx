
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
} from 'expo-router';

import { getToken } from '@/services/token.service';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const token = await getToken();

        if (!mounted) return;

        if (token) {
          router.replace('/');
        } else {
          router.replace('/login');
        }
      } catch (error) {
        console.error('Token check failed:', error);

        if (mounted) {
          router.replace('/login');
        }
      } finally {
        if (mounted) {
          setAuthChecked(true);
        }
      }
    }

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  if (!authChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="create-organization" options={{ title: 'Create Organization' }} />
        <Stack.Screen name="organizations" options={{ title: 'Organizations' }} />
        <Stack.Screen name="departments" options={{ title: 'Departments' }} />
        <Stack.Screen name="create-user" options={{ title: 'Create User' }} />
        <Stack.Screen name="users" options={{ title: 'Users' }} />
        <Stack.Screen name="edit-user" options={{ title: 'Edit User' }} />
        <Stack.Screen name="explore" options={{ headerShown: false }} />
        <Stack.Screen
  name="role-permissions"
  options={{ title: 'Role & Permissions' }}
/>
      </Stack>
    </ThemeProvider>
  );
}
