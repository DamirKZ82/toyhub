import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';

import { Screen } from '@/components/Screen';
import { Loader } from '@/components/Loader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { HallCard } from '@/components/HallCard';
import { ProviderCard } from '@/components/ProviderCard';
import { CategoryBar } from '@/components/CategoryBar';
import { FiltersBar, FiltersBarValue } from '@/components/FiltersBar';
import { CityPicker } from '@/components/CityPicker';
import { DatePickerSheet } from '@/components/DatePicker';
import { GuestsPicker } from '@/components/GuestsPicker';
import { FiltersSheet, SortOption } from '@/components/FiltersSheet';

import { dictsApi, searchApi, ApiError } from '@/api';
import type {
  Amenity, Category, City, HallCardData, ProviderAttrType, ProviderCardData,
} from '@/api/types';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useRequireAuth } from '@/store/useRequireAuth';
import { radii, spacing } from '@/theme';
import { useStyles } from '@/theme/useStyles';
import { useThemeColors } from '@/theme/useThemeColors';
import { dictName } from '@/utils/i18nDict';
import { useAuthStore } from '@/store/authStore';
import { findNearestCity } from '@/utils/cityCoords';
import { secureGet, secureSet } from '@/store/secureStorage';
import type { SearchStackParamList } from '@/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<SearchStackParamList, 'SearchHome'>;

const PAGE_SIZE = 20;
const SAVED_CITY_KEY = 'toyhana.selectedCityId';

type CitySource = 'user' | 'geo' | 'none';

export default function SearchScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const lang = useAuthStore((s) => s.user?.language ?? 'ru');
  const styles = useStyles((cc) => ({
    list: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl },
    count: { fontSize: 13, color: cc.muted, marginBottom: spacing.sm },
    banner: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: cc.primaryContainer,
      borderRadius: radii.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    bannerText: { flex: 1, fontSize: 13, color: cc.onSurface, marginLeft: spacing.sm },
    bannerClose: { padding: 4 },
  }));

  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const isRestaurant = category?.code === 'restaurant';

  const [cities, setCities] = useState<City[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [attrTypes, setAttrTypes] = useState<ProviderAttrType[]>([]);

  const [city, setCity] = useState<City | null>(null);
  const [citySource, setCitySource] = useState<CitySource>('none');
  const [showNoCityBanner, setShowNoCityBanner] = useState(false);

  const [date, setDate] = useState<string | null>(null);
  const [guests, setGuests] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [sort, setSort] = useState<SortOption>('rating_desc');

  const [cityOpen, setCityOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [hallItems, setHallItems] = useState<HallCardData[]>([]);
  const [provItems, setProvItems] = useState<ProviderCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const favGuids = useFavoritesStore((s) => s.guids);
  const isFav = useCallback((g: string) => favGuids.has(g), [favGuids]);
  const toggleFav = useFavoritesStore((s) => s.toggle);
  const toggleProviderFav = useFavoritesStore((s) => s.toggleProvider);
  const requireAuth = useRequireAuth();

  const citySettledRef = useRef(false);

  // Справочники + определение города (один раз)
  useEffect(() => {
    (async () => {
      try {
        const [catsResp, citiesResp, amenitiesResp] = await Promise.all([
          dictsApi.categories(),
          dictsApi.cities(),
          dictsApi.amenities(),
        ]);
        setCategories(catsResp.items);
        setCities(citiesResp.items);
        setAmenities(amenitiesResp.items);
        const restaurant = catsResp.items.find((x) => x.code === 'restaurant');
        setCategory(restaurant ?? catsResp.items[0] ?? null);

        const savedRaw = await secureGet(SAVED_CITY_KEY);
        if (savedRaw) {
          const savedId = parseInt(savedRaw, 10);
          const found = citiesResp.items.find((x) => x.id === savedId);
          if (found) {
            setCity(found);
            setCitySource('user');
            citySettledRef.current = true;
            return;
          }
        }

        try {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (perm.granted) {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const nearest = findNearestCity(citiesResp.items, point, 50);
            if (nearest) {
              setCity(nearest.city);
              setCitySource('geo');
              citySettledRef.current = true;
              return;
            } else {
              setShowNoCityBanner(true);
            }
          }
        } catch { /* ignore геолокацию */ }
      } catch { /* покажем ошибку при поиске */ }
      citySettledRef.current = true;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Атрибуты исполнителя — при смене категории (кроме ресторана)
  useEffect(() => {
    if (!category || category.code === 'restaurant') { setAttrTypes([]); return; }
    (async () => {
      try {
        const r = await dictsApi.providerAttrTypes(category.code);
        setAttrTypes(r.items);
      } catch { setAttrTypes([]); }
    })();
  }, [category]);

  const filtersValue: FiltersBarValue = useMemo(() => ({
    city,
    date,
    guests: isRestaurant ? guests : null,
    priceMax,
    amenityCount: tagIds.length,
  }), [city, date, guests, priceMax, tagIds, isRestaurant]);

  const doSearch = useCallback(async (pageToLoad: number, replace: boolean) => {
    if (!category) return;
    if (pageToLoad === 1) setLoading(true);
    setError(null);
    try {
      if (category.code === 'restaurant') {
        const resp = await searchApi.halls({
          city_id: city?.id,
          date: date ?? undefined,
          guests: guests ?? undefined,
          price_max: priceMax ?? undefined,
          amenity_ids: tagIds.length ? tagIds : undefined,
          sort,
          page: pageToLoad,
          page_size: PAGE_SIZE,
        });
        setTotal(resp.total);
        setPage(resp.page);
        setHasMore(resp.page * resp.page_size < resp.total);
        setHallItems((prev) => (replace ? resp.items : [...prev, ...resp.items]));
      } else {
        const resp = await searchApi.providers({
          category_id: category.id,
          city_id: city?.id,
          date: date ?? undefined,
          price_max: priceMax ?? undefined,
          attr_ids: tagIds.length ? tagIds : undefined,
          sort,
          page: pageToLoad,
          page_size: PAGE_SIZE,
        });
        setTotal(resp.total);
        setPage(resp.page);
        setHasMore(resp.page * resp.page_size < resp.total);
        setProvItems((prev) => (replace ? resp.items : [...prev, ...resp.items]));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error_generic'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, city, date, guests, priceMax, tagIds, sort, t]);

  useEffect(() => {
    if (!citySettledRef.current || !category) return;
    doSearch(1, true);
  }, [category, city, date, guests, priceMax, tagIds, sort, doSearch]);

  const onRefresh = () => { setRefreshing(true); doSearch(1, true); };
  const onEndReached = () => {
    if (loading || !hasMore) return;
    doSearch(page + 1, false);
  };

  const handleSelectCity = async (next: City) => {
    setCity(next);
    setCitySource('user');
    setShowNoCityBanner(false);
    await secureSet(SAVED_CITY_KEY, String(next.id));
  };

  const onSelectCategory = (cat: Category) => {
    if (cat.id === category?.id) return;
    setCategory(cat);
    setHallItems([]);
    setProvItems([]);
    setTotal(0);
    setPage(1);
    setHasMore(false);
    setPriceMax(null);
    setTagIds([]);
    setGuests(null);
    setSort('rating_desc');
  };

  const listHeader = (
    <>
      {error ? <ErrorBanner message={error} /> : null}
      {showNoCityBanner ? (
        <View style={styles.banner}>
          <Icon name="information-outline" size={18} color={c.primary} />
          <Text style={styles.bannerText}>{t('search.no_city_nearby')}</Text>
          <Pressable onPress={() => setShowNoCityBanner(false)} hitSlop={8} style={styles.bannerClose}>
            <Icon name="close" size={18} color={c.muted} />
          </Pressable>
        </View>
      ) : null}
      {citySource === 'geo' && city ? (
        <View style={styles.banner}>
          <Icon name="crosshairs-gps" size={18} color={c.primary} />
          <Text style={styles.bannerText}>
            {t('search.city_detected', { city: dictName(city, lang) })}
          </Text>
          <Pressable onPress={() => setCitySource('user')} hitSlop={8} style={styles.bannerClose}>
            <Icon name="close" size={18} color={c.muted} />
          </Pressable>
        </View>
      ) : null}
      <Text style={styles.count}>{t('search.results_count', { count: total })}</Text>
    </>
  );

  return (
    <Screen padded={false}>
      <CategoryBar
        categories={categories}
        selectedId={category?.id ?? null}
        onSelect={onSelectCategory}
      />
      <FiltersBar
        value={filtersValue}
        onCityPress={() => setCityOpen(true)}
        onDatePress={() => setDateOpen(true)}
        onGuestsPress={() => setGuestsOpen(true)}
        onExtraFilters={() => setFiltersOpen(true)}
      />

      {loading && hallItems.length === 0 && provItems.length === 0 ? (
        <Loader />
      ) : isRestaurant ? (
        <FlatList
          data={hallItems}
          keyExtractor={(it) => it.hall.guid}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            !loading && !error ? (
              <EmptyState title={t('search.no_results')} subtitle={t('search.no_results_hint')} />
            ) : null
          }
          renderItem={({ item }) => (
            <HallCard
              item={item}
              isFavorite={isFav(item.hall.guid)}
              onToggleFavorite={() =>
                requireAuth('favorite', () => toggleFav(item.hall.guid, !isFav(item.hall.guid)))
              }
              onPress={() => navigation.navigate('HallDetails', { hallGuid: item.hall.guid })}
            />
          )}
        />
      ) : (
        <FlatList
          data={provItems}
          keyExtractor={(it) => it.provider.guid}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            !loading && !error ? (
              <EmptyState title={t('search.no_results')} subtitle={t('search.no_results_hint')} />
            ) : null
          }
          renderItem={({ item }) => (
            <ProviderCard
              item={item}
              isFavorite={isFav(item.provider.guid)}
              onToggleFavorite={() =>
                requireAuth('favorite', () =>
                  toggleProviderFav(item.provider.guid, !isFav(item.provider.guid)))
              }
              onPress={() =>
                navigation.navigate('ProviderDetails', { providerGuid: item.provider.guid })
              }
            />
          )}
        />
      )}

      <CityPicker
        visible={cityOpen}
        cities={cities}
        onSelect={handleSelectCity}
        onClose={() => setCityOpen(false)}
      />
      <DatePickerSheet
        visible={dateOpen}
        value={date}
        onChange={setDate}
        onClose={() => setDateOpen(false)}
      />
      <GuestsPicker
        visible={guestsOpen}
        value={guests}
        onChange={setGuests}
        onClose={() => setGuestsOpen(false)}
      />
      <FiltersSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        amenities={isRestaurant ? amenities : attrTypes}
        amenitiesLabel={isRestaurant ? undefined : t('provider.attrs_label')}
        value={{ priceMax, amenityIds: tagIds, sort }}
        onApply={(v) => {
          setPriceMax(v.priceMax);
          setTagIds(v.amenityIds);
          setSort(v.sort);
        }}
      />
    </Screen>
  );
}
