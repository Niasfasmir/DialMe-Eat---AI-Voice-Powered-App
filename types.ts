
export enum UserRole {
  ADMIN = 'ADMIN',
  RESTAURANT = 'RESTAURANT',
  RIDER = 'RIDER',
  CUSTOMER = 'CUSTOMER'
}

export enum EntityStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  imageUrl?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  ownerId: string;
  status: EntityStatus;
  items: MenuItem[];
  categories?: string[];
  username?: string;
  password?: string;
  profileImageUrl?: string;
  location?: LatLng;
  mobile?: string;
  address?: string;
  commissionPercentage?: number;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  whatsapp: string;
  address: string;
  username: string;
  password: string;
  profileImageUrl?: string;
  location?: LatLng;
}

export interface Rider {
  id: string;
  name: string;
  status: EntityStatus;
  currentOrderId?: string;
  username?: string;
  password?: string;
  mobile?: string;
  profileImageUrl?: string;
  location?: LatLng;
}

export interface Order {
  id: string;
  customerId: string;
  restaurantId: string;
  items: MenuItem[];
  total: number;
  deliveryFee: number;
  distance: number;
  status: OrderStatus;
  riderId?: string;
  createdAt: number;
}

export enum OrderStatus {
  PLACED = 'PLACED',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED'
}

export interface GlobalState {
  restaurants: Restaurant[];
  customers: Customer[];
  riders: Rider[];
  orders: Order[];
  currentUserRole: UserRole;
  loggedInRestaurantId?: string;
  loggedInRiderId?: string;
  loggedInCustomerId?: string;
  adminPassword?: string;
  isAdminLoggedIn?: boolean;
}
