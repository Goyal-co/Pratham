export type UserRole = "student" | "admin";

export type MealType = "breakfast" | "lunch" | "dinner";

export type OrderStatus =
  | "placed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderSource = "adhoc" | "fixed_plan";

export type ReferralStatus = "pending" | "earned" | "ineligible";

export type LedgerType =
  | "order_charge"
  | "wallet_applied"
  | "cod_collection"
  | "referral_credit"
  | "adjustment";

export interface AppSettings {
  id: number;
  breakfast_cutoff: string; // HH:mm
  lunch_cutoff: string;
  dinner_cutoff: string;
  referral_min_completed_orders: number;
  referral_reward_credits: number;
  default_credit_limit: number;
  /** Minutes before cutoff to send "closing soon" push (default 30) */
  reminder_lead_minutes?: number;
  timezone: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  hostel: string | null;
  room: string | null;
  referral_code: string;
  created_at: string;
}

export interface StudentAccount {
  student_id: string;
  credit_limit: number;
  outstanding_balance: number;
  wallet_credit: number;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  meal_type: MealType;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  image_url: string | null;
  /** YYYY-MM-DD when this is a day-specific dish; null = catalog default */
  menu_date?: string | null;
}

export interface Order {
  id: string;
  student_id: string;
  meal_type: MealType;
  menu_item_id: string | null;
  quantity: number;
  unit_price: number;
  gross_amount: number;
  wallet_applied: number;
  payable_amount: number;
  status: OrderStatus;
  source: OrderSource;
  order_date: string; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedPlan {
  id: string;
  student_id: string;
  meal_type: MealType;
  menu_item_id: string | null;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
}

export interface Referral {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: ReferralStatus;
  completed_orders: number;
  earned_at: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}
