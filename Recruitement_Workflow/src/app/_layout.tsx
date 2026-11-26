
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
import { getCandidateToken } from '@/services/candidate-session.service';
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

    if ((!token || !accountType) && !pathname.startsWith('/candidate-')) {
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
  }, [pathname, router]);

  useEffect(() => {
    if (!authChecked) return;
    let active = true;

    async function validateRouteAccess() {
      try {
        const [token, accountType] = await Promise.all([getToken(), getAccountType()]);
        if (!active) return;

        if (pathname.startsWith('/candidate-')) {
          const candidateToken = await getCandidateToken();
          if (!active) return;
          if (['/candidate-dashboard', '/candidate-jobs', '/candidate-job-details', '/candidate-applications', '/candidate-offers', '/candidate-offer-details', '/candidate-onboarding', '/candidate-onboarding-details'].includes(pathname)) {
            if (!candidateToken) router.replace('/candidate-login');
            return;
          }
          if (pathname === '/candidate-login' || pathname === '/candidate-register') {
            if (candidateToken) router.replace('/candidate-dashboard');
            return;
          }
        }

        if (!token || !accountType) {
          if (pathname !== '/login') router.replace('/login');
          return;
        }

        if (pathname === '/login') {
          if (accountType === 'platform_admin') {
            router.replace('/platform-admin');
          } else {
            const organization = await getCurrentOrganizationUser();
            router.replace(getLandingRoute(organization.role_name, accountType) as never);
          }
          return;
        }

        const platformOnlyRoutes = ['/platform-admin', '/organizations', '/create-organization'];
        const organizationAdminRoutes = ['/', '/departments', '/users', '/create-user', '/edit-user', '/role-permissions'];
        const applicationRoutes = ['/applications', '/application-details'];
        const roleDashboardRoutes = [
          '/recruiter-dashboard', '/hiring-manager-dashboard', '/interviewer-dashboard',
        ];
        const requirementRoutes = [
  '/requirements',
  '/create-requirement',
];
        const interviewRoutes = ['/interviews', '/interview-details'];
        const applicationReviewRoutes = ['/application-review', '/application-review-details'];
        const onboardingRoutes = ['/onboarding', '/onboarding-details'];
        const jobDescriptionRoutes = ['/job-descriptions', '/job-description-details'];
        const offerRoutes = ['/offers', '/offer-details'];
        if (accountType === 'platform_admin') {
          if (pathname === '/' || pathname === '/explore' || roleDashboardRoutes.includes(pathname)) {
            router.replace('/platform-admin');
          }
          return;
        }

        if (pathname === '/' || roleDashboardRoutes.includes(pathname)) {
          const organization = await getCurrentOrganizationUser();
          const landingRoute = getLandingRoute(organization.role_name, accountType);
          if (pathname !== landingRoute) router.replace(landingRoute as never);
          return;
        }

        if (platformOnlyRoutes.includes(pathname)) {
          router.replace('/');
          return;
        }

        const organization = await getCurrentOrganizationUser();
        const landingRoute = getLandingRoute(organization.role_name, accountType);
        const redirectToRoleLanding = () => {
          if (pathname !== landingRoute) router.replace(landingRoute as never);
        };

if (organizationAdminRoutes.includes(pathname)) {
  if (organization.role_name !== 'Organization Admin') {
    redirectToRoleLanding();
  }
  return;
}

if (applicationRoutes.includes(pathname)) {
  if (!organization.permissions?.includes('application.view')) {
    redirectToRoleLanding();
  }
  return;
}

if (requirementRoutes.includes(pathname)) {
  const permissions = organization.permissions ?? [];

  if (pathname === '/requirements') {
    const canView =
      permissions.includes('requirement.view') ||
      permissions.includes('requirement.approve') ||
      permissions.includes('requirement.manage');

    if (!canView) {
      redirectToRoleLanding();
    }
  } else if (!permissions.includes('requirement.manage')) {
    redirectToRoleLanding();
  }
}

if (interviewRoutes.includes(pathname) || pathname === '/interviewer-dashboard') {
  const permissions = organization.permissions ?? [];
  const canInterview = permissions.includes('interview.view') || permissions.includes('interview.manage') || permissions.includes('interview.feedback');
  if (!canInterview) redirectToRoleLanding();
}

if (applicationReviewRoutes.includes(pathname)) {
  const permissions = organization.permissions ?? [];
  if (!permissions.includes('application.review') || organization.role_name !== 'Hiring Manager') redirectToRoleLanding();
}

if (onboardingRoutes.includes(pathname)) {
  const permissions = organization.permissions ?? [];
  const canOnboard = permissions.includes('onboarding.view') || permissions.includes('onboarding.manage') || permissions.includes('onboarding.document.review') || permissions.includes('onboarding.complete');
  if (!canOnboard) redirectToRoleLanding();
}

if (jobDescriptionRoutes.includes(pathname)) {
  const permissions = organization.permissions ?? [];
  const canAccessJobs = ['job.view', 'job.manage', 'job.approve'].some((permission) => permissions.includes(permission));
  if (!canAccessJobs) redirectToRoleLanding();
}

if (offerRoutes.includes(pathname)) {
  const permissions = organization.permissions ?? [];
  const canAccessOffers = ['offer.view', 'offer.manage', 'offer.approve', 'offer.issue'].some((permission) => permissions.includes(permission));
  if (!canAccessOffers) redirectToRoleLanding();
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
        <Stack.Screen name="candidate-login" options={{ headerShown: false }} />
        <Stack.Screen name="candidate-register" options={{ headerShown: false }} />
        <Stack.Screen name="candidate-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="candidate-jobs" options={{ headerShown: false }} />
        <Stack.Screen name="candidate-job-details" options={{ headerShown: false }} />
        <Stack.Screen name="candidate-applications" options={{ headerShown: false }} />
        <Stack.Screen name="candidate-offers" options={{ headerShown: false }} />
        <Stack.Screen name="candidate-offer-details" options={{ headerShown: false }} />
        <Stack.Screen name="candidate-onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="candidate-onboarding-details" options={{ headerShown: false }} />
        <Stack.Screen name="applications" options={{ headerShown: false }} />
        <Stack.Screen name="application-details" options={{ headerShown: false }} />
        <Stack.Screen name="application-review" options={{ title: 'Application Review' }} />
        <Stack.Screen name="application-review-details" options={{ title: 'Application Review' }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="recruiter-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="hiring-manager-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="interviewer-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="interviews" options={{ title: 'Interview Management' }} />
        <Stack.Screen name="interview-details" options={{ title: 'Interview Details' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Onboarding Management' }} />
        <Stack.Screen name="onboarding-details" options={{ title: 'Onboarding Details' }} />
        <Stack.Screen name="job-descriptions" options={{ headerShown: false }} />
        <Stack.Screen name="job-description-details" options={{ headerShown: false }} />
        <Stack.Screen name="offers" options={{ headerShown: false }} />
        <Stack.Screen name="offer-details" options={{ headerShown: false }} />
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
      </Stack>

    </ThemeProvider>
  );
}
