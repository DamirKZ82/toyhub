import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import SearchScreen from '@/screens/client/C01_SearchScreen';
import HallDetailsScreen from '@/screens/client/C02_HallDetailsScreen';
import BookingFormScreen from '@/screens/client/C03_BookingFormScreen';
import ProviderDetailsScreen from '@/screens/client/C07_ProviderDetailsScreen';
import type { SearchStackParamList } from './types';
import { useThemeColors } from '@/theme/useThemeColors';

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStack() {
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
        name="SearchHome"
        component={SearchScreen}
        options={{ title: t('search.title') }}
      />
      <Stack.Screen name="HallDetails" component={HallDetailsScreen} options={{ title: '' }} />
      <Stack.Screen name="ProviderDetails" component={ProviderDetailsScreen} options={{ title: '' }} />
      <Stack.Screen
        name="BookingForm"
        component={BookingFormScreen}
        options={{ title: t('booking_form.title') }}
      />
    </Stack.Navigator>
  );
}
