import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import ProfileScreen from '@/screens/common/G01_ProfileScreen';
import MyVenuesScreen from '@/screens/owner/O01_MyVenuesScreen';
import VenueFormScreen from '@/screens/owner/O02_VenueFormScreen';
import VenueDetailsScreen from '@/screens/owner/O03_VenueDetailsScreen';
import HallFormScreen from '@/screens/owner/O04_HallFormScreen';
import IncomingBookingsScreen from '@/screens/owner/O05_IncomingBookingsScreen';
import BookingDetailsScreen from '@/screens/owner/O06_BookingDetailsScreen';
import HallCalendarScreen from '@/screens/owner/O07_HallCalendarScreen';
import ReviewReplyScreen from '@/screens/owner/O08_ReviewReplyScreen';
import MyProvidersScreen from '@/screens/owner/O09_MyProvidersScreen';
import ProviderFormScreen from '@/screens/owner/O10_ProviderFormScreen';

// Перенесено из BookingsStack (этап 11)
import MyBookingsScreen from '@/screens/client/C04_MyBookingsScreen';
import ReviewFormScreen from '@/screens/client/C06_ReviewFormScreen';
import HallDetailsScreen from '@/screens/client/C02_HallDetailsScreen';
import ProviderDetailsScreen from '@/screens/client/C07_ProviderDetailsScreen';

import type { ProfileStackParamList } from './types';
import { useThemeColors } from '@/theme/useThemeColors';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  const { t } = useTranslation();
  const c = useThemeColors();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.onSurface,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ title: t('profile.title') }}
      />
      <Stack.Screen
        name="MyVenues"
        component={MyVenuesScreen}
        options={{ title: t('owner.venues_title') }}
      />
      <Stack.Screen
        name="VenueForm"
        component={VenueFormScreen}
        options={({ route }) => ({
          title: route.params.venueGuid ? t('owner.venue_form_edit') : t('owner.venue_form_new'),
        })}
      />
      <Stack.Screen name="VenueDetails" component={VenueDetailsScreen} options={{ title: '' }} />
      <Stack.Screen
        name="HallForm"
        component={HallFormScreen}
        options={({ route }) => ({
          title: route.params.hallGuid ? t('owner.hall_form_edit') : t('owner.hall_form_new'),
        })}
      />
      <Stack.Screen
        name="IncomingBookings"
        component={IncomingBookingsScreen}
        options={{ title: t('owner.incoming_title') }}
      />
      <Stack.Screen
        name="BookingDetails"
        component={BookingDetailsScreen}
        options={{ title: t('owner.booking_details_title') }}
      />
      <Stack.Screen name="HallCalendar" component={HallCalendarScreen} options={{ title: '' }} />
      <Stack.Screen
        name="ReviewReply"
        component={ReviewReplyScreen}
        options={{ title: t('owner.review_reply_title') }}
      />
      <Stack.Screen
        name="MyProviders"
        component={MyProvidersScreen}
        options={{ title: t('owner.providers_title') }}
      />
      <Stack.Screen
        name="ProviderForm"
        component={ProviderFormScreen}
        options={({ route }) => ({
          title: route.params.providerGuid
            ? t('owner.provider_form_edit')
            : t('owner.provider_form_new'),
        })}
      />
      <Stack.Screen
        name="ProviderDetails"
        component={ProviderDetailsScreen}
        options={{ title: '' }}
      />

      {/* Перенесено из BookingsStack */}
      <Stack.Screen
        name="MyBookings"
        component={MyBookingsScreen}
        options={{ title: t('profile.my_bookings') }}
      />
      <Stack.Screen
        name="ReviewForm"
        component={ReviewFormScreen}
        options={{ title: t('review_form.title') }}
      />
      <Stack.Screen
        name="HallDetails"
        component={HallDetailsScreen}
        options={{ title: '' }}
      />
    </Stack.Navigator>
  );
}
