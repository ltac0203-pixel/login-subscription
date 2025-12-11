import { API_BASE_URL } from "./config";

export interface SubscriptionPlan {
  id: string;
  name?: string;
  price?: string | number;
  currency?: string;
}

type RawPlan = Partial<SubscriptionPlan> & {
  plan_id?: string;
  plan_name?: string;
  amount?: string | number;
  fee?: string | number;
  currency_code?: string;
};

export interface PlanListResponse {
  success?: boolean;
  plans?: RawPlan[];
  items?: RawPlan[];
  data?: RawPlan[];
  list?: RawPlan[];
  error?: string;
}

export interface SubscriptionRecord {
  plan_id: string;
  status: string;
  start_date?: string | null;
  next_charge_date?: string | null;
  cancel_at?: string | null;
  fincode_subscription_id?: string | null;
  fincode_customer_id?: string | null;
  fincode_card_id?: string | null;
}

export interface SubscriptionStatusResponse {
  success: boolean;
  plan?: SubscriptionPlan | null;
  subscription?: SubscriptionRecord | null;
  remote?: unknown;
  results?: unknown;
  message?: string;
  error?: string;
  public_key?: string;
}

export interface SubscriptionActionResponse {
  success: boolean;
  message?: string;
  subscription?: SubscriptionRecord | null;
  fincode_response?: unknown;
  card_id?: string;
  customer_id?: string;
  error?: string;
}

export interface SavedCard {
  id: string;
  brand?: string | null;
  card_no?: string | null;
  masked_card_no?: string | null;
  last_four?: string | null;
  expire?: string | null;
  expire_month?: string | number | null;
  expire_year?: string | number | null;
  holder_name?: string | null;
  fingerprint?: string | null;
  default_flag?: string | null;
  card_status?: string | null;
  raw?: unknown;
}

export interface CardListResponse {
  success?: boolean;
  cards?: SavedCard[];
  customer_id?: string | null;
  message?: string;
  error?: string;
}

interface SubscribePayload {
  card_token?: string;
  start_date?: string;
  plan_id?: string;
  customer_name?: string;
}

const normalizePlan = (plan: RawPlan): SubscriptionPlan | null => {
  const id = String(plan.id ?? plan.plan_id ?? "").trim();
  if (!id) {
    return null;
  }

  return {
    id,
    name: plan.name ?? plan.plan_name,
    price: plan.price ?? plan.amount ?? plan.fee,
    currency: plan.currency ?? plan.currency_code,
  };
};

const extractPlans = (
  payload: PlanListResponse | RawPlan[] | unknown
): SubscriptionPlan[] => {
  const candidates =
    (payload as PlanListResponse)?.plans ??
    (payload as PlanListResponse)?.items ??
    (payload as PlanListResponse)?.data ??
    (payload as PlanListResponse)?.list ??
    (Array.isArray(payload) ? (payload as RawPlan[]) : null);

  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates
    .map((plan) => normalizePlan(plan))
    .filter((plan): plan is SubscriptionPlan => Boolean(plan));
};

export const subscriptionAPI = {
  async getStatus(): Promise<SubscriptionStatusResponse> {
    const response = await fetch(`${API_BASE_URL}/api/subscription`, {
      method: "GET",
      credentials: "include",
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data.error || "サブスクリプション情報の取得に失敗しました"
      );
    }

    return data;
  },

  async getPlans(): Promise<SubscriptionPlan[]> {
    const response = await fetch(`${API_BASE_URL}/api/subscription/plans`, {
      method: "GET",
      credentials: "include",
    });

    let data: PlanListResponse | RawPlan[];
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "プラン情報の取得に失敗しました（レスポンス形式が不正です）"
      );
    }

    if (!response.ok) {
      throw new Error(
        (data as PlanListResponse)?.error || "プラン情報の取得に失敗しました"
      );
    }

    return extractPlans(data);
  },

  async subscribe(
    payload: SubscribePayload
  ): Promise<SubscriptionActionResponse> {
    const response = await fetch(`${API_BASE_URL}/api/subscription`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "サブスクリプション登録に失敗しました");
    }

    return data;
  },

  async getCards(): Promise<CardListResponse> {
    const response = await fetch(`${API_BASE_URL}/api/subscription/cards`, {
      method: "GET",
      credentials: "include",
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data.error || "保存済みカードの取得に失敗しました"
      );
    }

    return data;
  },

  async deleteCard(cardId: string): Promise<SubscriptionActionResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/subscription/cards/${encodeURIComponent(cardId)}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "カード削除に失敗しました");
    }

    return data;
  },

  async registerCard(payload: {
    card_token: string;
    customer_name?: string;
  }): Promise<SubscriptionActionResponse> {
    const response = await fetch(`${API_BASE_URL}/api/subscription/card`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "カード登録に失敗しました");
    }

    return data;
  },

  async cancel(): Promise<SubscriptionActionResponse> {
    const response = await fetch(`${API_BASE_URL}/api/subscription`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "サブスクリプション解約に失敗しました");
    }

    return data;
  },
};
