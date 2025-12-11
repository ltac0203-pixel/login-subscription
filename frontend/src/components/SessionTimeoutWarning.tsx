import React, { useMemo } from "react";

interface SessionTimeoutWarningProps {
  show: boolean;
  remainingTime: number | null;
  onExtend: () => void;
  onLogout: () => void;
}

export const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  show,
  remainingTime,
  onExtend,
  onLogout,
}) => {
  const displayTime = useMemo(() => {
    if (remainingTime === null) return "";
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    return `${minutes}分${seconds}秒`;
  }, [remainingTime]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            セッションタイムアウト警告
          </h2>
          <p className="text-gray-600">
            セッションが間もなくタイムアウトします。
          </p>
          <p className="text-lg font-semibold text-orange-600 mt-2">
            残り時間: {displayTime}
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
          <p className="text-sm text-yellow-800">
            継続して作業を行う場合は「セッションを延長」をクリックしてください。
            そのままにするとログアウトされます。
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onExtend}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            セッションを延長
          </button>
          <button
            onClick={onLogout}
            className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors font-medium"
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  );
};
