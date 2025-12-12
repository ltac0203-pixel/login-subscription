import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../../api/auth";

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = "メールアドレスを入力してください";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "有効なメールアドレスを入力してください";
    }

    if (!formData.password) {
      newErrors.password = "パスワードを入力してください";
    } else if (formData.password.length < 8) {
      newErrors.password = "パスワードは8文字以上で入力してください";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "パスワード（確認）を入力してください";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "パスワードが一致しません";
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

    try {
      await authApi.register({
        email: formData.email,
        password: formData.password,
      });

      navigate("/login", {
        state: { message: "登録が完了しました。ログインしてください。" },
      });
    } catch (error) {
      if (error instanceof Error) {
        setErrors({ general: error.message });
      } else {
        setErrors({ general: "登録に失敗しました" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white py-12 px-4">
      {/* Minimalist geometric background */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-white"></div>

        {/* Geometric line pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div
            className="h-full w-full"
            style={{
              backgroundColor: "#000",
            }}
          ></div>
        </div>
      </div>

      <div className="relative z-10 max-w-md w-full">
        <div className="text-center mb-8 space-y-6 animate-fade-in-up">
          <Link to="/" className="inline-block group">
            <h1 className="text-4xl sm:text-5xl font-thin tracking-tighter text-gray-900 transition-transform duration-200">
              Tsunagi
            </h1>
          </Link>
          <h2 className="text-2xl sm:text-3xl font-thin tracking-tight text-gray-900">
            アカウントを作成
          </h2>
        </div>

        <form
          className="bg-white border border-gray-200 p-8 space-y-6"
          onSubmit={handleSubmit}
        >
          {errors.general && (
            <div className="border border-red-500 bg-red-50 p-4">
              <p className="text-sm text-red-600 font-light">
                {errors.general}
              </p>
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
                autoComplete="new-password"
                required
                className={`block w-full px-4 py-3 border ${
                  errors.password
                    ? "border-red-500"
                    : "border-gray-200 focus:border-gray-900"
                } bg-white text-gray-900 placeholder-gray-400 focus:outline-none transition-all duration-300 font-light`}
                placeholder="8文字以上"
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

            <div className="group">
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-mono uppercase tracking-wider text-gray-500 mb-2"
              >
                パスワード（確認）
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className={`block w-full px-4 py-3 border ${
                  errors.confirmPassword
                    ? "border-red-500"
                    : "border-gray-200 focus:border-gray-900"
                } bg-white text-gray-900 placeholder-gray-400 focus:outline-none transition-all duration-300 font-light`}
                placeholder="パスワードを再入力"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-red-500 font-light">
                  {errors.confirmPassword}
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
                  <>登録中...</>
                ) : (
                  <>
                    新規登録
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
              すでにアカウントをお持ちですか？
            </p>
            <Link
              to="/login"
              className="inline-flex items-center text-sm font-light text-gray-900 cursor-pointer border border-gray-900 px-4 py-2"
            >
              ログインはこちら
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

export default RegisterForm;
