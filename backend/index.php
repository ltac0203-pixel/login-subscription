<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once 'core/SessionManager.php';

use App\Core\SessionManager;

SessionManager::initSession();

header('Content-Type: application/json');

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");

if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
}

$allowed_origins = [
    'http://localhost:5173',
    'https://tsunagi.space'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config/database.php';
require_once 'core/Router.php';
require_once 'core/BaseController.php';
require_once 'core/FincodeClient.php';
require_once 'controllers/AuthController.php';
require_once 'controllers/SubscriptionController.php';

$router = new Router();

$router->post('/api/register', 'AuthController', 'register');
$router->post('/api/login', 'AuthController', 'login');
$router->post('/api/logout', 'AuthController', 'logout');
$router->get('/api/user', 'AuthController', 'getUser');
$router->get('/api/session-status', 'AuthController', 'getSessionStatus');

$router->get('/api/subscription/cards', 'SubscriptionController', 'getCards');
$router->delete('/api/subscription/cards/{cardId}', 'SubscriptionController', 'deleteCard');
$router->get('/api/subscription/plans', 'SubscriptionController', 'getPlans');
$router->get('/v1/plans', 'SubscriptionController', 'getPlans');
$router->get('/api/subscription', 'SubscriptionController', 'get');
$router->post('/api/subscription/card', 'SubscriptionController', 'registerCard');
$router->post('/api/subscription', 'SubscriptionController', 'subscribe');
$router->delete('/api/subscription', 'SubscriptionController', 'cancel');

set_error_handler(function ($severity, $message, $file, $line) {
    error_log("PHP Error [$severity]: $message in $file on line $line");
    http_response_code(500);
    echo json_encode([
        'error' => 'サーバーエラーが発生しました'
    ]);
    exit;
});

try {
    $router->handleRequest();
} catch (Exception $e) {
    error_log('Unhandled exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'error' => 'サーバーエラーが発生しました'
    ]);
}
