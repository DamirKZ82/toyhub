import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import FavoritesScreen from '@/screens/client/C05_FavoritesScreen';
import HallDetailsScreen from '@/screens/client/C02_HallDetailsScreen';
import BookingFormScreen from '@/screens/client/C03_BookingFormScreen';
import ProviderDetailsScreen from '@/screens/client/C07_ProviderDetailsScreen';
import type { FavoritesStackParamList } from './types';
import { useThemeColors } from '@/theme/useThemeColors';

const Stack = createNativeStackNavigator<FavoritesStackParamList>();

export function FavoritesStack() {
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
        name="FavoritesHome"
        component={FavoritesScreen}
        options={{ title: t('favorites.title') }}
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
