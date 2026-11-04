
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
import { getCurrentOrganizationUser, getLandingRoute, logoutUser } from '@/services/auth.service';

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

    if (!token || !accountType) {
      router.replace('/login');
    }
    // Preserve the requested route for authenticated users.
    // Route access is handled by validateRouteAccess().
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
          if (accountType === 'platform_admin') {
            router.replace('/platform-admin');
          } else {
            const organization = await getCurrentOrganizationUser();
            router.replace(getLandingRoute(organization.role_name) as never);
          }
          return;
        }

        const platformOnlyRoutes = ['/platform-admin', '/organizations', '/create-organization'];
        const organizationAdminRoutes = ['/', '/departments', '/users', '/create-user', '/edit-user', '/role-permissions'];
        const requirementRoutes = [
  '/requirements',
  '/create-requirement',
  '/edit-requirement',
];
        if (accountType === 'platform_admin') {
          if (pathname === '/' || pathname === '/explore') {
            router.replace('/platform-admin');
          }
          return;
        }

        const roleDashboardRoutes = [
          '/recruiter-dashboard', '/hiring-manager-dashboard', '/interviewer-dashboard',
        ];
        if (pathname === '/' || roleDashboardRoutes.includes(pathname)) {
          const organization = await getCurrentOrganizationUser();
          const landingRoute = getLandingRoute(organization.role_name);
          if (pathname !== landingRoute) router.replace(landingRoute as never);
          return;
        }

        if (platformOnlyRoutes.includes(pathname)) {
          router.replace('/');
          return;
        }

        const organization = await getCurrentOrganizationUser();

if (organizationAdminRoutes.includes(pathname)) {
  if (organization.role_name !== 'Organization Admin') {
    router.replace('/explore');
  }
  return;
}

if (requirementRoutes.includes(pathname)) {
  const permissions = organization.permissions ?? [];

  if (pathname === '/requirements') {
    const canView =
      permissions.includes('requirement.view') ||
      permissions.includes('requirement.approve');

    if (!canView) {
      router.replace('/explore');
    }
  } else if (!permissions.includes('requirement.manage')) {
    router.replace('/requirements');
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
        <Stack.Screen name="recruiter-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="hiring-manager-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="interviewer-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="module" options={{ title: 'Recruitment module' }} />
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
        <Stack.Screen
  name="requirements"
  options={{ title: 'Requirement Management' }}
/>
<Stack.Screen
  name="create-requirement"
  options={{ title: 'Create Requirement' }}
/>
<Stack.Screen
  name="edit-requirement"
  options={{ title: 'Edit Requirement' }}
/>
      </Stack>

    </ThemeProvider>
  );
}
