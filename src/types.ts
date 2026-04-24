export type Screen = 
  | 'login'
  | 'otp'
  | 'profile'
  | 'dashboard'
  | 'input'
  | 'loading'
  | 'result'
  | 'map'
  | 'tasks';

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
