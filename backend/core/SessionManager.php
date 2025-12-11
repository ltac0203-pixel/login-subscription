<?php

namespace App\Core;

class SessionManager
{
    private const SESSION_TIMEOUT = 3600;
    private const SESSION_REFRESH_TIME = 300;

    public static function initSession()
    {
        ini_set('session.use_strict_mode', 1);
        ini_set('session.cookie_httponly', 1);
        ini_set('session.use_only_cookies', 1);

        if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
            ini_set('session.cookie_secure', 1);
        }

        ini_set('session.cookie_samesite', 'Lax');

        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        self::checkSessionTimeout();

        self::regenerateSessionId();
    }

    public static function checkSessionTimeout()
    {
        if (isset($_SESSION['LAST_ACTIVITY'])) {
            $inactive_time = time() - $_SESSION['LAST_ACTIVITY'];

            if ($inactive_time > self::SESSION_TIMEOUT) {
                self::destroySession();
                return false;
            }
        }

        $_SESSION['LAST_ACTIVITY'] = time();
        return true;
    }

    public static function regenerateSessionId()
    {
        if (!isset($_SESSION['CREATED'])) {
            $_SESSION['CREATED'] = time();
        } else {
            $session_age = time() - $_SESSION['CREATED'];

            if ($session_age > self::SESSION_REFRESH_TIME) {
                session_regenerate_id(true);
                $_SESSION['CREATED'] = time();
            }
        }
    }

    public static function isAuthenticated()
    {
        if (!self::checkSessionTimeout()) {
            return false;
        }

        return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
    }

    public static function login($userId, $userEmail)
    {
        session_regenerate_id(true);

        $_SESSION['user_id'] = $userId;
        $_SESSION['user_email'] = $userEmail;
        $_SESSION['CREATED'] = time();
        $_SESSION['LAST_ACTIVITY'] = time();
    }

    public static function destroySession()
    {
        $_SESSION = array();

        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params["path"],
                $params["domain"],
                $params["secure"],
                $params["httponly"]
            );
        }

        session_destroy();
    }

    public static function getSessionInfo()
    {
        if (!self::isAuthenticated()) {
            return null;
        }

        $remaining_time = self::SESSION_TIMEOUT;
        if (isset($_SESSION['LAST_ACTIVITY'])) {
            $remaining_time = self::SESSION_TIMEOUT - (time() - $_SESSION['LAST_ACTIVITY']);
        }

        return [
            'user_id' => $_SESSION['user_id'] ?? null,
            'user_email' => $_SESSION['user_email'] ?? null,
            'remaining_time' => max(0, $remaining_time),
            'timeout' => self::SESSION_TIMEOUT
        ];
    }
}
