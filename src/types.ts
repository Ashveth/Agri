export type Screen = 
  | 'login'
  | 'otp'
  | 'profile'
  | 'dashboard'
  | 'input'
  | 'loading'
  | 'result'
  | 'map'
  | 'history';

export interface Farmer {
  uid: string;
  phoneNumber: string;
  name: string;
  age?: number;
  location: string;
  farms?: string;
  profilePhoto?: string;
}

export interface Prediction {
  id: string;
  product: string;
  location: string;
  date: string;
  demand: 'High' | 'Medium' | 'Low';
  price: number;
  bestLocation: string;
  bestTime: string;
  trend: string;
}
