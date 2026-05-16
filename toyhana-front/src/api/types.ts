/**
 * Типы данных из бэка.
 * snake_case сохраняем, чтобы не было конверсии и не потерять что-то при рефакторинге.
 */

export interface User {
  id: number;
  guid: string;
  phone: string;
  full_name: string | null;
  language: 'ru' | 'kz';
}

export interface AuthVerifyResponse {
  token: string;
  is_new_user: boolean;
  user: User;
}

export interface City {
  id: number;
  name_ru: string;
  name_kz: string;
}

export interface Amenity {
  id: number;
  code: string;
  name_ru: string;
  name_kz: string;
  icon: string | null;
}

export interface EventType {
  id: number;
  code: string;
  name_ru: string;
  name_kz: string;
}

// ---------------------- Categories / Providers ----------------------

export interface Category {
  id: number;
  code: string;
  name_ru: string;
  name_kz: string;
  icon: string | null;
  sort_order: number;
}

/** Краткая категория внутри карточки/деталей исполнителя/брони. */
export interface CategoryBrief {
  id: number;
  code: string;
  name_ru: string;
  name_kz: string;
}

/** Атрибут исполнителя — та же форма, что и Amenity (id/code/name/icon). */
export type ProviderAttr = Amenity;

export interface ProviderAttrType extends Amenity {
  sort_order?: number;
  category_code?: string;
}

export type PriceUnit = 'event' | 'hour' | 'person' | 'day';

export interface ProviderBrief {
  id: number;
  guid: string;
  name: string;
  description: string | null;
  price_from: number | null;
  price_unit: PriceUnit | null;
  latitude?: number | null;
  longitude?: number | null;
  is_active?: boolean;
}

export interface ProviderCardData {
  provider: ProviderBrief;
  category: CategoryBrief;
  city: City;
  main_photo: string | null;
  main_thumb: string | null;
  rating: { avg: number; count: number };
  is_busy_on_date: boolean;
}

export interface ProviderSearchResponse {
  items: ProviderCardData[];
  total: number;
  page: number;
  page_size: number;
  date: string | null;
}

export interface PublicProviderDetails {
  id: number;
  guid: string;
  name: string;
  description: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  price_from: number | null;
  price_unit: PriceUnit | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  photos: HallPhoto[];
  attrs: ProviderAttr[];
  category: CategoryBrief;
  city: City;
}

export interface Holiday {
  date: string;
  name_ru: string;
  name_kz: string;
}

export interface ApiErrorBody {
  message?: string;
}

// ---------------------- Search / Hall / Venue ----------------------

export interface HallBrief {
  id: number;
  guid: string;
  name: string;
  description: string | null;
  area_sqm: number | null;
  capacity_min: number | null;
  capacity_max: number | null;
  price_weekday: number;
  price_weekend: number;
}

export interface VenueBrief {
  id: number;
  guid: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export interface HallCardData {
  hall: HallBrief & { is_active?: boolean };
  venue: VenueBrief & { is_active?: boolean };
  city: City;
  main_photo: string | null;
  main_thumb: string | null;
  rating: { avg: number; count: number };
  price_on_date: number;
  price_is_estimate: boolean;
  is_busy_on_date: boolean;
}

export interface SearchResponse {
  items: HallCardData[];
  total: number;
  page: number;
  page_size: number;
  date: string | null;
  is_weekend_or_holiday: boolean | null;
}

export interface HallPhoto {
  id: number;
  file_path: string;
  thumb_path: string;
  sort_order: number;
}

export interface HallDetails extends HallBrief {
  venue_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  photos: HallPhoto[];
  amenities: Amenity[];
}

// ---------------------- Bookings ----------------------

export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

export type SubjectType = 'hall' | 'provider';

/** Унифицированный subject брони/чата — зал или исполнитель. */
export interface BookingSubject {
  type: SubjectType;
  guid: string | null;
  name: string | null;
  /** Для зала — название заведения; для исполнителя — null. */
  parent_name: string | null;
  deleted: boolean;
  category_code?: string | null;
}

export interface Booking {
  id: number;
  guid: string;
  event_date: string;
  guests_count: number;
  event_type_id: number | null;
  comment: string | null;
  status: BookingStatus;
  rejected_reason: string | null;
  price_at_booking: number | null;
  created_at: string;
  updated_at: string;
  subject: BookingSubject;
  hall: {
    id: number;
    guid: string | null;
    name: string | null;
    venue_name: string | null;
  } | null;
  provider: {
    id: number;
    guid: string | null;
    name: string | null;
    category_code: string | null;
  } | null;
  hall_deleted: boolean;
  client?: { name: string | null; phone: string | null };
}

export interface CalendarDay {
  date: string;
  status: 'free' | 'pending' | 'confirmed' | 'past';
  price: number | null;
  is_weekend: boolean;
}

export interface CalendarResponse {
  hall_guid?: string;
  provider_guid?: string;
  price_unit?: PriceUnit | null;
  month: string;
  items: CalendarDay[];
}

// ---------------------- Reviews ----------------------

export interface Review {
  id: number;
  guid: string;
  rating: number;
  text: string | null;
  owner_reply: string | null;
  owner_reply_at: string | null;
  created_at: string;
  client_name: string;
}

export interface ReviewsResponse {
  items: Review[];
  avg_rating: number;
  reviews_count: number;
}

// ---------------------- Favorites ----------------------

export interface HallFavoriteItem extends HallCardData {
  type: 'hall';
  favorited_at: string;
}

export interface ProviderFavoriteItem extends ProviderCardData {
  type: 'provider';
  favorited_at: string;
}

export type FavoriteItem = HallFavoriteItem | ProviderFavoriteItem;
