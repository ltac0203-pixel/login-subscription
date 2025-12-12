import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SessionMonitor } from "./components/SessionMonitor";
import ProtectedRoute from "./components/auth/ProtectedRoute";

const Subscription = lazy(() => import("./pages/Subscription"));
const LoginForm = lazy(() => import("./components/auth/LoginForm"));
const RegisterForm = lazy(() => import("./components/auth/RegisterForm"));

const RootRedirect = () => <Navigate to="/subscription" replace />;

function App() {
  return (
    <Router>
      <AuthProvider>
        <SessionMonitor>
          <Suspense
            fallback={
              <div className="p-6 text-center text-sm text-gray-600">
                読み込み中...
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginForm />} />
              <Route path="/register" element={<RegisterForm />} />
              <Route
                path="/subscription"
                element={
                  <ProtectedRoute>
                    <Subscription />
                  </ProtectedRoute>
                }
              />
              <Route path="/dashboard" element={<Navigate to="/subscription" replace />} />
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </Suspense>
        </SessionMonitor>
      </AuthProvider>
    </Router>
  );
}

export default App;
