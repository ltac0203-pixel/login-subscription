import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  subscriptionAPI,
  type SubscriptionPlan,
  type SubscriptionRecord,
  type SavedCard,
} from "../api/subscription";

const statusLabelMap: Record<string, string> = {
  active: "アクティブ",
  pending: "開始待ち",
  canceled: "解約済み",
  card_registered: "カード登録済み",
};

type FincodeUIFormData = {
  cardNo?: string;
  CVC?: string;
  cvc?: string;
  year?: string;
  month?: string;
  expire?: string;
  card_no?: string;
  security_code?: string;
  expireMonth?: string;
  expireYear?: string;
  payTimes?: string;
  pay_times?: string;
  method?: string;
  [key: string]: unknown;
};

type FincodeUI = {
  create: (method: string, appearance: Record<string, unknown>) => void;
  mount: (elementId: string, width?: string | number) => void;
  getFormData: () => Promise<FincodeUIFormData>;
  destroy: () => void;
};

type FincodeInstance = {
  ui: (appearance: Record<string, unknown>) => FincodeUI;
  tokens: (
    payload: Record<string, unknown>,
    callback: (status: number, data: unknown) => void,
    errorCallback: (error: unknown) => void
  ) => void;
};

declare global {
  interface Window {
    Fincode?: (apiKey: string) => FincodeInstance;
  }
}

const FINCODE_JS_URL =
  import.meta.env.VITE_FINCODE_JS_URL?.trim() ||
  "https://js.test.fincode.jp/v1/fincode.js";
const FINCODE_ELEMENT_ID = "fincode";
const FINCODE_ELEMENT_FORM_ID = "fincode-form";

const fincodeAppearance: Record<string, unknown> = {
  layout: "vertical",
  hideLabel: false,
  hideHolderName: true,
  hidePayTimes: true,
  payTimes: "1",
  labelCardNo: "カード番号",
  labelExpire: "有効期限",
  labelCvc: "セキュリティコード",
  labelPaymentMethod: "お支払い回数",
  cardNo: "1234 5678 9012 3456",
  expireMonth: "01",
  expireYear: "25",
  cvc: "123",
  colorBackground: "ffffff",
  colorBackgroundInput: "f7f7f7",
  colorText: "111111",
  colorPlaceHolder: "818181",
  colorLabelText: "111111",
  colorBorder: "d1d5db",
  colorError: "c12424",
  colorCheck: "000054",
};

const normalizeExpire = (
  rawExpire?: string,
  rawYear?: string,
  rawMonth?: string
): string => {
  const cleanedExpire = rawExpire?.replace(/\D/g, "");
  if (cleanedExpire && cleanedExpire.length >= 4) {
    return cleanedExpire.slice(0, 4);
  }

  const normalizedYear = rawYear ? rawYear.replace(/\D/g, "").slice(-2) : "";
  const normalizedMonth = rawMonth
    ? rawMonth.replace(/\D/g, "").padStart(2, "0").slice(-2)
    : "";

  if (normalizedYear && normalizedMonth) {
    return `${normalizedYear}${normalizedMonth}`;
  }

  return "";
};

const extractTokenString = (value: unknown, depth = 0): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!value || typeof value !== "object" || depth > 4) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const token = extractTokenString(item, depth + 1);
      if (token) {
        return token;
      }
    }
    return null;
  }

  const source = value as Record<string, unknown>;
  const candidates = [
    source.token,
    source.id,
    source.card_token,
    source.cardToken,
    source.card,
    source.list,
    source.tokens,
    source.items,
    source.data,
    source.result,
    source.response,
  ];

  for (const candidate of Object.values(source)) {
    const token = extractTokenString(candidate, depth + 1);
    if (token) {
      return token;
    }
  }

  for (const candidate of candidates) {
    const token = extractTokenString(candidate, depth + 1);
    if (token) {
      return token;
    }
  }

  return null;
};

const extractExpireValue = (
  value: unknown,
  depth = 0
): string | number | null => {
  if (depth > 4 || value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractExpireValue(item, depth + 1);
      if (extracted !== null && extracted !== undefined) {
        return extracted as string | number;
      }
    }
    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  for (const candidate of Object.values(value as Record<string, unknown>)) {
    const extracted = extractExpireValue(candidate, depth + 1);
    if (extracted !== null && extracted !== undefined) {
      return extracted as string | number;
    }
  }

  const source = value as Record<string, unknown>;
  const candidates = [
    source.expire,
    source.expiration,
    source.token_expire,
    source.list,
    source.items,
    source.data,
    source.result,
    source.response,
  ];

  for (const candidate of candidates) {
    const extracted = extractExpireValue(candidate, depth + 1);
    if (extracted !== null && extracted !== undefined) {
      return extracted as string | number;
    }
  }

  return null;
};

const parseTokenExpiry = (value: string | number | null): Date | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    const asString = String(value);
    if (asString.length === 14) {
      return parseYYYYMMDDHHMMSS(asString);
    }
    return new Date(asString.length > 10 ? value : Math.floor(value) * 1000);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{14}$/.test(trimmed)) {
    return parseYYYYMMDDHHMMSS(trimmed);
  }

  if (/^\d{10,13}$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return new Date(trimmed.length > 10 ? numeric : Math.floor(numeric) * 1000);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isExpired = (expiry: Date | null): boolean => {
  if (!expiry) return false;
  return expiry.getTime() <= Date.now();
};

const parseYYYYMMDDHHMMSS = (value: string): Date | null => {
  if (!/^\d{14}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));
  const second = Number(value.slice(12, 14));
  const date = new Date(year, month, day, hour, minute, second);
  return Number.isNaN(date.getTime()) ? null : date;
};

function Subscription() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(
    null
  );
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const startDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<unknown>(null);
  const [publicKey, setPublicKey] = useState<string>("");
  const [fincodeLoading, setFincodeLoading] = useState(true);
  const [fincodeReady, setFincodeReady] = useState(false);
  const [fincodeSetupError, setFincodeSetupError] = useState<string | null>(
    null
  );
  const fincodeRef = useRef<FincodeInstance | null>(null);
  const fincodeUiRef = useRef<FincodeUI | null>(null);
  const fincodeKeyRef = useRef<string>("");
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [confirmDeleteCardId, setConfirmDeleteCardId] = useState<string | null>(
    null
  );

  const statusBadgeClass = useMemo(() => {
    const base =
      "inline-flex items-center px-3 py-1 text-xs font-semibold tracking-wide rounded-full";
    if (!subscription) return `${base} bg-gray-100 text-gray-600`;
    switch (subscription.status) {
      case "active":
        return `${base} bg-green-100 text-green-800`;
      case "pending":
        return `${base} bg-yellow-100 text-yellow-800`;
      case "canceled":
        return `${base} bg-red-100 text-red-700`;
      case "card_registered":
        return `${base} bg-blue-100 text-blue-800`;
      default:
        return `${base} bg-gray-100 text-gray-600`;
    }
  }, [subscription]);

  const fetchStatus = async () => {
    let planError: string | null = null;
    try {
      setLoading(true);
      setError(null);

      const [statusData, fetchedPlans] = await Promise.all([
        subscriptionAPI.getStatus(),
        subscriptionAPI.getPlans().catch((err) => {
          planError =
            err instanceof Error
              ? err.message
              : "プラン情報の取得に失敗しました。";
          return null;
        }),
      ]);

      const mergedPlans = [
        ...(fetchedPlans ?? []),
        ...(statusData.plan ? [statusData.plan] : []),
      ].reduce<SubscriptionPlan[]>((uniquePlans, current) => {
        if (!current?.id) return uniquePlans;
        if (uniquePlans.some((planItem) => planItem.id === current.id)) {
          return uniquePlans;
        }
        return [...uniquePlans, current];
      }, []);

      setPlans(mergedPlans);

      const preferredPlanId =
        statusData.subscription?.plan_id ||
        statusData.plan?.id ||
        mergedPlans[0]?.id;

      const preferredPlan =
        mergedPlans.find((item) => item.id === preferredPlanId) ||
        statusData.plan ||
        mergedPlans[0] ||
        null;

      setPlan(preferredPlan);
      setSubscription(statusData.subscription ?? null);
      setResults(statusData.results ?? null);
      const apiPublicKey =
        typeof statusData.public_key === "string"
          ? statusData.public_key.trim()
          : "";
      if (apiPublicKey) {
        setPublicKey(apiPublicKey);
        setFincodeSetupError(null);
      } else {
        setFincodeSetupError(".env の public_key が取得できませんでした");
        setFincodeReady(false);
        setFincodeLoading(false);
      }
      if (planError) {
        setError(planError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const loadSavedCards = useCallback(async () => {
    if (loading) {
      return;
    }
    try {
      setCardsLoading(true);
      setCardsError(null);
      const response = await subscriptionAPI.getCards();
      setSavedCards(response.cards ?? []);
    } catch (err) {
      setCardsError(
        err instanceof Error ? err.message : "カード情報の取得に失敗しました"
      );
      setSavedCards([]);
    } finally {
      setCardsLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (!publicKey || loading) {
      return;
    }

    const formContainer = document.getElementById(FINCODE_ELEMENT_FORM_ID);
    const uiContainer = document.getElementById(FINCODE_ELEMENT_ID);
    if (!formContainer || !uiContainer) {
      setFincodeSetupError("カード入力エリアの初期化に失敗しました。");
      return;
    }

    let canceled = false;
    let injectedScript: HTMLScriptElement | null = null;

    const loadScript = () =>
      new Promise<void>((resolve, reject) => {
        if (window.Fincode) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = FINCODE_JS_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("fincode.js の読み込みに失敗しました"));
        injectedScript = script;
        document.body.appendChild(script);
      });

    const setupFincode = async () => {
      if (fincodeKeyRef.current === publicKey && fincodeUiRef.current) {
        setFincodeReady(true);
        setFincodeLoading(false);
        setFincodeSetupError(null);
        return;
      }

      try {
        setFincodeLoading(true);
        setFincodeReady(false);
        await loadScript();
        if (canceled) return;

        if (!window.Fincode) {
          throw new Error("fincode.js の初期化に失敗しました");
        }

        const fincode = window.Fincode(publicKey);
        const ui = fincode.ui(fincodeAppearance);
        ui.create("payments", fincodeAppearance);
        const measuredWidth =
          uiContainer.getBoundingClientRect().width ||
          uiContainer.clientWidth ||
          formContainer.clientWidth ||
          window.innerWidth ||
          320;
        const widthNumber = Math.min(
          Math.max(Math.floor(measuredWidth), 260),
          420
        );
        ui.mount(FINCODE_ELEMENT_ID, String(widthNumber));

        fincodeRef.current = fincode;
        fincodeUiRef.current = ui;
        fincodeKeyRef.current = publicKey;

        setFincodeReady(true);
        setFincodeSetupError(null);
      } catch (err) {
        if (!canceled) {
          setFincodeSetupError(
            err instanceof Error
              ? err.message
              : "カード入力フォームの初期化に失敗しました"
          );
          setFincodeReady(false);
        }
      } finally {
        if (!canceled) {
          setFincodeLoading(false);
        }
      }
    };

    setupFincode();

    return () => {
      canceled = true;
      fincodeUiRef.current?.destroy?.();
      fincodeUiRef.current = null;
      fincodeRef.current = null;
      if (injectedScript && injectedScript.parentNode) {
        injectedScript.parentNode.removeChild(injectedScript);
      }
    };
  }, [publicKey, loading]);

  useEffect(() => {
    if (loading) {
      return;
    }
    loadSavedCards();
  }, [
    subscription?.fincode_card_id,
    subscription?.fincode_customer_id,
    loading,
    loadSavedCards,
  ]);

  const registerCardWithToken = async (token: string) => {
    const response = await subscriptionAPI.registerCard({
      card_token: token.trim(),
    });
    setMessage(response.message || "カードを登録しました");
    await fetchStatus();
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!cardId) return;

    try {
      setDeletingCardId(cardId);
      setMessage(null);
      setError(null);
      const response = await subscriptionAPI.deleteCard(cardId);
      setMessage(response.message || "カードを削除しました");
      await fetchStatus();
      await loadSavedCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "カード削除に失敗しました");
    } finally {
      setDeletingCardId(null);
    }
  };

  const requestDeleteCard = (cardId: string) => {
    setConfirmDeleteCardId(cardId);
  };

  const cancelDeleteCard = () => {
    setConfirmDeleteCardId(null);
  };

  const confirmDeleteCard = async () => {
    const targetId = confirmDeleteCardId;
    setConfirmDeleteCardId(null);
    if (targetId) {
      await handleDeleteCard(targetId);
    }
  };

  const handleRegisterCardFromForm = async () => {
    if (!fincodeReady || !fincodeUiRef.current || !fincodeRef.current) {
      setError(fincodeSetupError || "カード入力フォームの準備中です。");
      return;
    }

    try {
      setActionLoading(true);
      setMessage(null);
      setError(null);

      const form = await fincodeUiRef.current.getFormData();
      if (!form) {
        throw new Error("カード情報の取得に失敗しました");
      }
      const rawCardNo =
        typeof form.cardNo === "string"
          ? form.cardNo
          : typeof form.card_no === "string"
          ? form.card_no
          : "";
      const cardNo = rawCardNo.replace(/\D/g, "");
      const cvc =
        (typeof form.CVC === "string" && form.CVC.trim()) ||
        (typeof form.cvc === "string" && form.cvc.trim()) ||
        (typeof form.security_code === "string" && form.security_code.trim()) ||
        "";
      const year =
        typeof form.year === "string"
          ? form.year
          : typeof form.expireYear === "string"
          ? form.expireYear
          : "";
      const month =
        typeof form.month === "string"
          ? form.month
          : typeof form.expireMonth === "string"
          ? form.expireMonth
          : "";
      const expire = normalizeExpire(
        typeof form.expire === "string" ? form.expire : undefined,
        year,
        month
      );
      const payTimes =
        typeof form.payTimes === "string"
          ? form.payTimes
          : typeof form.pay_times === "string"
          ? form.pay_times
          : "1";
      const method = typeof form.method === "string" ? form.method : "1";

      if (!cardNo || !cvc || !expire) {
        throw new Error("カード番号・有効期限・CVCを入力してください");
      }

      const payload: Record<string, unknown> = {
        card_no: cardNo,
        expire,
        security_code: cvc,
        number: "1",
        pay_type: "Card",
        method,
        pay_times: payTimes,
      };

      const tokenFromForm =
        extractTokenString(form.token) ||
        extractTokenString(form.card_token) ||
        extractTokenString(form.cardToken);

      const issueToken = async (): Promise<{
        token: string;
        expiresAt: Date | null;
      }> => {
        const tokenResponse = await new Promise<unknown>((resolve, reject) => {
          if (tokenFromForm) {
            resolve({ token: tokenFromForm });
            return;
          }

          fincodeRef.current?.tokens(
            payload,
            (status, data) => {
              if (status >= 200 && status < 300) {
                resolve(data);
              } else {
                const message =
                  (data as { error_message?: string })?.error_message ||
                  (data as { errors?: { error_message?: string }[] })
                    ?.errors?.[0]?.error_message ||
                  "カードトークンの発行に失敗しました";
                reject(new Error(message));
              }
            },
            (err) => {
              reject(
                new Error(
                  typeof err === "string"
                    ? err
                    : "カードトークンの送信に失敗しました"
                )
              );
            }
          );
        });

        const extractedToken = extractTokenString(tokenResponse);

        if (!extractedToken) {
          throw new Error("カードトークンの取得に失敗しました");
        }

        const expireRaw = extractExpireValue(tokenResponse);
        const expiresAt = parseTokenExpiry(expireRaw);

        return { token: extractedToken, expiresAt };
      };

      let tokenResult = await issueToken();

      if (isExpired(tokenResult.expiresAt)) {
        tokenResult = await issueToken();
        if (isExpired(tokenResult.expiresAt)) {
          throw new Error(
            "カードトークンの有効期限が切れています。再度入力してください。"
          );
        }
      }

      await registerCardWithToken(tokenResult.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "カード登録に失敗しました");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubscribe = async (event: React.FormEvent) => {
    event.preventDefault();
    const hasSavedCard = Boolean(subscription?.fincode_card_id);
    if (!hasSavedCard) {
      setError("カード登録を行ってからサブスクリプションを開始してください。");
      return;
    }
    if (!plan?.id) {
      setError("プランを選択してください。");
      return;
    }

    try {
      setActionLoading(true);
      setMessage(null);
      setError(null);

      const payload: {
        start_date?: string;
        plan_id?: string;
      } = {
        start_date: startDate,
        plan_id: plan?.id,
      };

      const response = await subscriptionAPI.subscribe(payload);

      setMessage(response.message || "サブスクリプションを開始しました");
      await fetchStatus();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "サブスクリプション登録に失敗しました"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!subscription || subscription.status === "canceled") {
      return;
    }
    if (!window.confirm("サブスクリプションを解約しますか？")) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      setMessage(null);
      const response = await subscriptionAPI.cancel();
      setMessage(response.message || "サブスクリプションを解約しました");
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "解約に失敗しました");
    } finally {
      setActionLoading(false);
    }
  };

  const formatCardExpire = (card: SavedCard): string => {
    const expire = typeof card.expire === "string" ? card.expire.trim() : "";
    if (expire) return expire;
    const month =
      typeof card.expire_month === "string" ||
      typeof card.expire_month === "number"
        ? String(card.expire_month).padStart(2, "0")
        : "";
    const year =
      typeof card.expire_year === "string" ||
      typeof card.expire_year === "number"
        ? String(card.expire_year).slice(-2)
        : "";
    if (month && year) {
      return `${month}/${year}`;
    }
    return "不明";
  };

  const formatDate = (date?: string | null) => {
    if (!date) return "—";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatPriceLabel = (targetPlan?: SubscriptionPlan | null) => {
    if (!targetPlan) return "プラン情報を取得できませんでした";
    if (
      targetPlan.price === undefined ||
      targetPlan.price === null ||
      targetPlan.price === ""
    ) {
      return "価格未設定";
    }

    return `${targetPlan.price}${
      targetPlan.currency ? ` ${targetPlan.currency}` : ""
    } / month`;
  };

  const renderJsonPreview = (data: unknown): React.ReactNode | null => {
    if (!data) return null;
    return (
      <pre className="bg-gray-50 text-gray-800 text-xs p-4 rounded border border-gray-200 overflow-auto max-h-64">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  const heading = plan?.name || "プラン未選択";
  const priceLabel = formatPriceLabel(plan);

  return (
    <div className="min-h-screen relative overflow-hidden bg-white text-gray-900">
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-white" />
        <div className="absolute inset-0 opacity-[0.02]">
          <div
            className="h-full w-full"
            style={{
              backgroundColor: "#000",
            }}
          ></div>
        </div>
        <div className="absolute inset-0 opacity-[0.015]">
          <div
            className="h-full w-full"
            style={{
              backgroundColor: "#000",
            }}
          ></div>
        </div>
      </div>

      <div className="relative z-10">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-12 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div className="space-y-3">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-thin tracking-tight leading-none">
                  サブスクリプション管理
                </h1>
              </div>
            </div>
            <div className="w-16 h-[1px] bg-gray-900 opacity-20" />
            {actionLoading && (
              <div className="flex items-center gap-2 text-xs text-gray-500 font-mono tracking-[0.14em]">
                <span className="w-4 h-[1px] bg-gray-400"></span>
                <span>処理中...</span>
              </div>
            )}
          </div>

          {message && (
            <div className="mb-6 bg-white border-2 border-green-300 text-green-800 p-4">
              <p className="text-sm">{message}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-white border-2 border-red-300 text-red-700 p-4">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-20">
                <div className="text-sm text-gray-700">読み込み中...</div>
              </div>
            )}
            <div
              className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${
                loading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 p-6 relative overflow-hidden">
                  <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-gray-900/5" />
                  <div className="relative flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-gray-500">
                        Plan
                      </p>
                      <h2 className="text-2xl font-semibold text-gray-900 mt-1">
                        {heading}
                      </h2>
                    </div>
                  </div>
                  <p className="text-3xl font-light text-gray-900 mb-2">
                    {priceLabel}
                  </p>
                  <div className="text-sm text-gray-700">
                    {plans.length === 0 ? (
                      <p>
                        プラン情報を取得できませんでした。再読み込みしてください。
                      </p>
                    ) : (
                      <p>利用可能なプランから選択してください。</p>
                    )}
                  </div>
                  {plans.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {plans.map((availablePlan) => {
                        const isActive = availablePlan.id === plan?.id;
                        return (
                          <button
                            type="button"
                            key={availablePlan.id}
                            onClick={() => setPlan(availablePlan)}
                            className={`text-left border px-4 py-3 rounded cursor-pointer ${
                              isActive
                                ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                                : "border-gray-200 bg-white text-gray-900"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold">
                                  {availablePlan.name || "名称未設定のプラン"}
                                </p>
                                <p
                                  className={`text-xs mt-1 ${
                                    isActive ? "text-gray-100" : "text-gray-600"
                                  }`}
                                >
                                  {formatPriceLabel(availablePlan)}
                                </p>
                              </div>
                              {isActive && (
                                <span className="text-[10px] uppercase tracking-[0.2em]">
                                  選択中
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-gray-500">
                        Status
                      </p>
                      <h3 className="text-xl font-semibold text-gray-900">
                        サブスクリプション状況
                      </h3>
                    </div>
                    <span className={statusBadgeClass}>
                      {subscription
                        ? statusLabelMap[subscription.status] ||
                          subscription.status
                        : "未登録"}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">開始日</dt>
                      <dd className="text-gray-900 font-medium">
                        {formatDate(subscription?.start_date)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">次回課金予定日</dt>
                      <dd className="text-gray-900 font-medium">
                        {formatDate(subscription?.next_charge_date)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {!!results && (
                  <div className="bg-white border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-gray-500">
                          請求履歴
                        </p>
                        <h3 className="text-lg font-semibold text-gray-900">
                          直近の結果
                        </h3>
                      </div>
                    </div>
                    {renderJsonPreview(results)}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-gray-500">
                        Saved
                      </p>
                      <h3 className="text-xl font-semibold text-gray-900">
                        保存済みカード
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={loadSavedCards}
                      disabled={cardsLoading || loading}
                      className="text-[11px] uppercase tracking-[0.16em] border border-gray-300 px-3 py-1.5 text-gray-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      再読み込み
                    </button>
                  </div>

                  {cardsError && (
                    <p className="text-xs text-red-600 mb-3">{cardsError}</p>
                  )}

                  {cardsLoading ? (
                    <div className="text-sm text-gray-600">
                      カード情報を読み込み中...
                    </div>
                  ) : savedCards.length === 0 ? (
                    <p className="text-sm text-gray-600">
                      保存済みカードはありません。カードを登録するとここに表示されます。
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {savedCards.map((card) => (
                        <div
                          key={card.id}
                          className="border border-gray-200 rounded p-4 bg-gray-50 flex flex-col gap-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-10 w-16 rounded bg-gray-900 text-white flex items-center justify-center text-[11px] uppercase tracking-[0.14em]">
                                {card.brand || "Card"}
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <p className="text-sm font-semibold text-gray-900">
                                  •••• {card.last_four ?? "----"}
                                </p>
                                <p className="text-xs text-gray-600">
                                  有効期限: {formatCardExpire(card)}
                                </p>
                              </div>
                            </div>
                            {card.default_flag === "1" && (
                              <span className="text-[10px] uppercase tracking-[0.18em] text-gray-700 bg-gray-200 px-2 py-1 rounded whitespace-nowrap">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => requestDeleteCard(card.id)}
                              disabled={
                                deletingCardId === card.id || actionLoading
                              }
                              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-red-400 text-red-600 rounded cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {deletingCardId === card.id ? (
                                <>
                                  <span className="h-2 w-2 rounded-full bg-red-500" />
                                  削除中...
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-trash" />
                                  削除
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-gray-500">
                        Card
                      </p>
                      <h3 className="text-xl font-semibold text-gray-900">
                        カードを登録
                      </h3>
                    </div>
                  </div>

                  {fincodeSetupError && (
                    <p className="text-xs text-red-600 mb-2">
                      {fincodeSetupError}
                    </p>
                  )}
                  <form
                    id={FINCODE_ELEMENT_FORM_ID}
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleRegisterCardFromForm();
                    }}
                  >
                    <div
                      id={FINCODE_ELEMENT_ID}
                      className="w-full max-w-full overflow-hidden rounded bg-white min-h-[260px]"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-[11px] text-gray-500">
                        カード情報は fincode
                        へ直接送信され、当サービスのサーバーには保存されません。
                      </p>
                      <button
                        id="submit"
                        type="submit"
                        disabled={
                          !fincodeReady || fincodeLoading || actionLoading
                        }
                        className="inline-flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2 text-sm tracking-wide disabled:bg-gray-400 disabled:cursor-not-allowed w-full sm:w-auto cursor-pointer"
                      >
                        {actionLoading ? (
                          <>
                            <span className="h-2 w-2 rounded-full bg-white" />
                            登録中...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-magic" />
                            カード情報で登録
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-gray-500">
                        登録
                      </p>
                      <h3 className="text-xl font-semibold text-gray-900">
                        サブスクリプション開始
                      </h3>
                    </div>
                  </div>
                  <form onSubmit={handleSubscribe} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        プラン選択
                      </label>
                      {plans.length > 0 ? (
                        <select
                          value={plan?.id || ""}
                          onChange={(e) => {
                            const selected = plans.find(
                              (item) => item.id === e.target.value
                            );
                            setPlan(selected ?? null);
                          }}
                          className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                        >
                          <option value="">プランを選択してください</option>
                          {plans.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name || "名称未設定"}（
                              {formatPriceLabel(item)}）
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-gray-600">
                          プランを取得できませんでした。ページを再読み込みしてください。
                        </p>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full inline-flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2 text-sm tracking-wide cursor-pointer disabled:bg-gray-400"
                    >
                      {actionLoading ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-white" />
                          登録処理中...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-play-fill" />
                          サブスクリプションを開始
                        </>
                      )}
                    </button>
                  </form>
                </div>

                <div className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-gray-500">
                        解約
                      </p>
                      <h3 className="text-xl font-semibold text-gray-900">
                        サブスクリプションを停止
                      </h3>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    次回課金を停止します。解約後も再登録は可能です。
                  </p>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={
                      !subscription ||
                      subscription.status === "canceled" ||
                      actionLoading
                    }
                    className="w-full inline-flex items-center justify-center gap-2 border border-red-500 text-red-600 px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="bi bi-x-circle" />
                    解約する
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {confirmDeleteCardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded shadow-xl w-full max-w-md border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">
                カードを削除しますか？
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                削除するとこのカードは利用できなくなります。
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {(() => {
                const target = savedCards.find(
                  (card) => card.id === confirmDeleteCardId
                );
                if (!target) return null;
                return (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-16 rounded bg-gray-900 text-white flex items-center justify-center text-[11px] uppercase tracking-[0.14em]">
                      {target.brand || "Card"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        •••• {target.last_four ?? "----"}
                      </p>
                      <p className="text-xs text-gray-600">
                        有効期限: {formatCardExpire(target)}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={cancelDeleteCard}
                className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-700 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmDeleteCard}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded cursor-pointer"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Subscription;
