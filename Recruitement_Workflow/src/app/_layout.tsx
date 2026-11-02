
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  usePathname,
} from 'expo-router';

import { Colors } from '@/constants/theme';
import { getToken, getAccountType } from '@/services/token.service';
import { getCurrentOrganizationUser, logoutUser } from '@/services/auth.service';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const token = await getToken();
        const accountType = await getAccountType();

        if (!mounted) return;

        if (token && accountType === "platform_admin") {
          router.replace("/platform-admin");
        } else if (token && accountType === "organization_user") {
          router.replace("/");
          
        } else {
          router.replace("/login");
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
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    let active = true;

    async function validateRouteAccess() {
      try {
        const [token, accountType] = await Promise.all([getToken(), getAccountType()]);
        if (!active) return;

        if (!token || !accountType) {
          if (pathname !== '/login') router.replace('/login');
          return;
        }

        if (pathname === '/login') {
          router.replace(accountType === 'platform_admin' ? '/platform-admin' : '/');
          return;
        }

        const platformOnlyRoutes = ['/platform-admin', '/organizations', '/create-organization'];
        const organizationAdminRoutes = ['/', '/departments', '/users', '/create-user', '/edit-user', '/role-permissions'];

        if (accountType === 'platform_admin') {
          if (pathname === '/' || pathname === '/explore' || pathname === '/role-permissions') {
            router.replace('/platform-admin');
          }
          return;
        }

        if (platformOnlyRoutes.includes(pathname)) {
          router.replace('/');
          return;
        }

        if (organizationAdminRoutes.includes(pathname)) {
          const organization = await getCurrentOrganizationUser();
          if (organization.role_name !== 'Organization Admin') {
            router.replace('/explore');
          }
        }
      } catch {
        void logoutUser();
        if (active) router.replace('/login');
      }
    }

    void validateRouteAccess();
    return () => { active = false; };
  }, [authChecked, pathname, router]);

  if (!authChecked) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.backgroundElement },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text, fontSize: 16, fontWeight: '600' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="create-organization"
          options={{ title: 'Create Organization' }}
        />
        <Stack.Screen
          name="organizations"
          options={{ title: 'Organizations' }}
        />
        <Stack.Screen name="departments" options={{ title: 'Departments' }} />
        <Stack.Screen name="create-user" options={{ title: 'Create User' }} />
        <Stack.Screen name="users" options={{ title: 'Users' }} />
        <Stack.Screen name="edit-user" options={{ title: 'Edit User' }} />
        <Stack.Screen name="explore" options={{ headerShown: false }} />
        <Stack.Screen
          name="role-permissions"
          options={{ title: 'Role & Permissions' }}
        />
        <Stack.Screen
          name="platform-admin"
          options={{ headerShown: false }}
        />
      </Stack>
    </ThemeProvider>
  );
}
