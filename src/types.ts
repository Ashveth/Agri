export type Screen = 
  | 'login'
  | 'otp'
  | 'profile'
  | 'dashboard'
  | 'realtime_dashboard'
  | 'input'
  | 'loading'
  | 'result'
  | 'map'
  | 'tasks'
  | 'inventory'
  | 'tracking'
  | 'optimization'
  | 'logistics'
  | 'delivery_prediction'
  | 'spoilage_prediction'
  | 'route_optimization'
  | 'supply_demand_matching'
  | 'load_optimization'
  | 'delivery_monitor'
  | 'weather';

export interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
  rainProbability: number;
  windSpeed: number;
  forecast: {
    day: string;
    low: number;
    high: number;
    condition: string;
    rainProbability: number;
  }[];
}

export interface DeliveryMonitor {
  id: string;
  userId: string;
  source: string;
  destination: string;
  distance: number; // in km
  trafficLevel: 'Low' | 'Medium' | 'High' | 'Severe';
  baseEtaMinutes: number;
  currentEtaMinutes: number;
  status: 'In Transit' | 'Delayed' | 'Arrived';
  lastUpdated: string;
  alerts: string[];
}

export interface TransportProvider {
  id: string;
  name: string;
  vehicleType: string;
  capacity: string;
  distance: string;
  estimatedCost: number;
  availability: 'Available' | 'Busy';
  rating: number;
  phone: string;
  icon: string;
}

export interface Truck {
  id: string;
  type: string;
  capacity: number; // in kg
  icon: string;
}

export interface LoadItem {
  id: string;
  name: string;
  quantity: number; // in kg
}

export interface OptimizationResult {
  loadPlan: string;
  usedCapacityPercent: number;
  remainingSpace: string;
  additionalSuggestion: string;
  numberOfTrips: number;
  costEfficiency: string;
}

export interface TrackingStage {
  id: string;
  name: 'Farm' | 'Transport' | 'Market';
  status: 'Completed' | 'In Progress' | 'Pending';
  location: string;
  timestamp: string;
  description: string;
}

export interface SupplyChainTrack {
  id: string;
  productId: string;
  productName: string;
  batchId: string;
  estimatedDelivery: string;
  currentLocation: string;
  stages: TrackingStage[];
}

export interface InventoryItem {
  id: string;
  name: string;
  availableStock: number;
  soldStock: number;
  remainingStock: number;
  threshold: number;
  unit: string;
  updatedAt: string;
}

export interface Farmer {
  uid: string;
  phoneNumber: string;
  name: string;
  age?: number;
  location: string;
  farms?: string;
  profilePhoto?: string;
  isProSubscriber?: boolean;
}

export interface MarketComparison {
  city: string;
  price: number;
  demand: 'High' | 'Medium' | 'Low';
  distance: string;
  isBest: boolean;
  reason?: string;
}

export interface Prediction {
  id: string;
  userId?: string;
  product: string;
  location: string;
  date: string;
  demand: 'High' | 'Medium' | 'Low' | 'Stable';
  price: number;
  bestLocation: string;
  bestTime: string;
  trend: string;
  comparisons?: MarketComparison[];
  createdAt?: any;
}

export interface FarmTask {
  id: string;
  userId: string;
  title: string;
  type: 'Planting' | 'Irrigation' | 'Harvesting' | 'Fertilizing' | 'Other';
  dueDate: string;
  status: 'Pending' | 'Completed';
  description?: string;
  createdAt: string;
}
