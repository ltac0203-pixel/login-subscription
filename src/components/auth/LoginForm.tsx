import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { AuthContext } from "../../contexts/auth-context";

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

interface LocationState {
  message?: string;
  from?: string;
}

const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error("LoginForm must be used within AuthProvider");
  }

  const { login } = authContext;

  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");

  useEffect(() => {
    if (state?.message) {
      setSuccessMessage(state.message);
      window.history.replaceState({}, document.title);
    }
  }, [state]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = "メールアドレスを入力してください";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "有効なメールアドレスを入力してください";
    }

    if (!formData.password) {
      newErrors.password = "パスワードを入力してください";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});
    setSuccessMessage("");

    try {
      await login(formData.email, formData.password);
      const from = state?.from || "/dashboard";
      navigate(from, { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        setErrors({ general: error.message });
      } else {
        setErrors({ general: "ログインに失敗しました" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white">
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-white"></div>

        <div className="absolute inset-0 opacity-[0.03]">
          <div
            className="h-full w-full"
            style={{
              backgroundColor: "#000",
            }}
          ></div>
        </div>
      </div>

      <div className="relative z-10 max-w-md w-full px-4">
        <div className="text-center mb-8 space-y-6 animate-fade-in-up">
          <Link to="/" className="inline-block group">
            <h1 className="text-4xl sm:text-5xl font-thin tracking-tighter text-gray-900 transition-transform duration-200">
              Tsunagi
            </h1>
          </Link>
          <h2 className="text-2xl sm:text-3xl font-thin tracking-tight text-gray-900">
            ログイン
          </h2>
        </div>

        <form
          noValidate
          className="bg-white border border-gray-200 p-8 space-y-6"
          onSubmit={handleSubmit}
        >
          {successMessage && (
            <div className="rounded-lg bg-ultra-state-success/10 border border-ultra-state-success/20 p-4 animate-ultra-slide-down">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-ultra-state-success"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-ultra-state-success">
                    {successMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          {errors.general && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 animate-ultra-slide-down">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-500">
                    {errors.general}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="group">
              <label
                htmlFor="email"
                className="block text-sm font-mono uppercase tracking-wider text-gray-500 mb-2"
              >
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`block w-full px-4 py-3 border ${
                  errors.email
                    ? "border-red-500"
                    : "border-gray-200 focus:border-gray-900"
                } bg-white text-gray-900 placeholder-gray-400 focus:outline-none transition-all duration-300 font-light`}
                placeholder="example@email.com"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="mt-2 text-sm text-red-500 font-light">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="group">
              <label
                htmlFor="password"
                className="block text-sm font-mono uppercase tracking-wider text-gray-500 mb-2"
              >
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={`block w-full px-4 py-3 border ${
                  errors.password
                    ? "border-red-500"
                    : "border-gray-200 focus:border-gray-900"
                } bg-white text-gray-900 placeholder-gray-400 focus:outline-none transition-all duration-300 font-light`}
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="mt-2 text-sm text-red-500 font-light">
                  {errors.password}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full flex justify-center py-3 px-4 bg-gray-900 text-white font-light tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center">
                {isLoading ? (
                  <>ログイン中...</>
                ) : (
                  <>
                    ログイン
                    <svg
                      className="ml-2 w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </div>

          <div className="text-center pt-6 space-y-4 border-t border-gray-200 mt-6">
            <p className="text-sm text-gray-600 font-light">
              アカウントをお持ちでない方は
            </p>
            <Link
              to="/register"
              className="inline-flex items-center text-sm font-light text-gray-900 cursor-pointer border border-gray-900 px-4 py-2"
            >
              新規登録はこちら
              <svg
                className="ml-2 w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
