import { z } from "zod";

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner"]);

export const placeOrderSchema = z.object({
  meal_type: mealTypeSchema,
  menu_item_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(10),
  notes: z.string().max(500).optional(),
  order_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const applyFixedPlanSchema = z.object({
  meal_type: mealTypeSchema,
  menu_item_id: z.string().uuid().nullable().optional(),
});

export const cancelPlanDaySchema = z.object({
  meal_type: mealTypeSchema,
  cancel_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const clearBalanceSchema = z.object({
  student_id: z.string().uuid(),
  new_balance: z.number().min(0).default(0),
  note: z.string().max(500).optional(),
});

export const setCreditLimitSchema = z.object({
  student_id: z.string().uuid(),
  credit_limit: z.number().min(0),
});

export const updateSettingsSchema = z.object({
  breakfast_cutoff: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  lunch_cutoff: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dinner_cutoff: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  referral_min_completed_orders: z.number().int().min(1).optional(),
  referral_reward_credits: z.number().min(0).optional(),
  default_credit_limit: z.number().min(0).optional(),
});

export const updateOrderStatusSchema = z.object({
  order_id: z.string().uuid(),
  status: z.enum([
    "placed",
    "preparing",
    "out_for_delivery",
    "delivered",
    "cancelled",
  ]),
});

export const signupReferralSchema = z.object({
  referral_code: z.string().min(4).max(16).optional(),
  full_name: z.string().min(1).max(120),
  phone: z.string().min(8).max(20).optional(),
  hostel: z.string().max(120).optional(),
  room: z.string().max(40).optional(),
});
