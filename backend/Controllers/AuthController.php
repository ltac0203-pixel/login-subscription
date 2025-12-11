<?php

namespace App\Controllers;

use App\Core\BaseController;
use App\Core\FincodeClient;
use App\Core\SessionManager;

class AuthController extends BaseController
{
    public function __construct($db = null)
    {
        if ($db) {
            $this->db = $db;
        } else {
            parent::__construct();
        }
    }

    public function register($params = [])
    {
        $pdo = null;
        try {
            $input = $this->getRequestBody();

            if (!$this->validateRequired($input, ['email', 'password'])) {
                return;
            }

            if (!is_string($input['email']) || !is_string($input['password'])) {
                $this->errorResponse('Invalid input data');
                return;
            }

            $email = filter_var(trim($input['email']), FILTER_VALIDATE_EMAIL);
            if (!$email) {
                $this->errorResponse('Invalid email format');
                return;
            }

            $email = strtolower($email);

            $pdo = $this->db->getConnection();
            $pdo->beginTransaction();

            $stmt = $this->db->query("SELECT id FROM users WHERE email = ?", [$email]);
            if ($stmt->rowCount() > 0) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                $this->errorResponse('User already exists', 409);
                return;
            }

            $fincodeCustomerId = null;
            try {
                $client = new FincodeClient();
                $customerName = $input['customer_name'] ?? $email;
                if (!is_string($customerName) || trim($customerName) === '') {
                    $customerName = $email;
                }

                $customerResponse = $client->createCustomer($customerName, $email);
                $fincodeCustomerId = $customerResponse['id'] ?? $customerResponse['customer_id'] ?? null;
            } catch (\Exception $e) {
                error_log('fincode customer create failed: ' . $e->getMessage());
            }

            if (!$fincodeCustomerId) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                $this->errorResponse('決済サービスの顧客登録に失敗しました', 500);
                return;
            }

            $hashedPassword = password_hash($input['password'], PASSWORD_DEFAULT);
            $this->db->query(
                "INSERT INTO users (email, password, fincode_customer_id, created_at) VALUES (?, ?, ?, NOW())",
                [$email, $hashedPassword, $fincodeCustomerId]
            );

            $userId = $this->db->lastInsertId();

            if ($pdo->inTransaction()) {
                $pdo->commit();
            }

            $this->successResponse([
                'message' => 'User registered successfully',
                'user_id' => $userId,
                'fincode_customer_id' => $fincodeCustomerId
            ]);
        } catch (\Exception $e) {
            if ($pdo && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('User registration error: ' . $e->getMessage());
            $this->errorResponse('User registration failed', 500);
        }
    }

    public function login($params = [])
    {
        try {
            $input = $this->getRequestBody();

            if (!$this->validateRequired($input, ['email', 'password'])) {
                return;
            }

            if (!is_string($input['email']) || !is_string($input['password'])) {
                $this->errorResponse('Invalid input data');
                return;
            }

            $email = filter_var(trim($input['email']), FILTER_VALIDATE_EMAIL);
            if (!$email) {
                $this->errorResponse('Invalid email format');
                return;
            }

            $password = $input['password'];

            $stmt = $this->db->query("SELECT id, email, password FROM users WHERE email = ?", [$email]);
            $user = $stmt->fetch();

            if (!$user || !password_verify($password, $user['password'])) {
                $this->errorResponse('Invalid credentials', 401);
                return;
            }

            SessionManager::login($user['id'], $user['email']);

            $this->successResponse([
                'message' => 'Login successful',
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email']
                ]
            ]);
        } catch (\Exception $e) {
            error_log('User login error: ' . $e->getMessage());
            $this->errorResponse('Login failed', 500);
        }
    }

    public function logout($params = [])
    {
        SessionManager::destroySession();

        $this->successResponse(['message' => 'Logout successful']);
    }

    public function getUser($params = [])
    {
        if (!SessionManager::isAuthenticated()) {
            $this->errorResponse('Not authenticated', 401);
            return;
        }

        $this->successResponse([
            'user' => [
                'id' => $_SESSION['user_id'],
                'email' => $_SESSION['user_email']
            ]
        ]);
    }

    public function getSessionStatus($params = [])
    {
        $sessionInfo = SessionManager::getSessionInfo();

        if ($sessionInfo === null) {
            $this->errorResponse('Session expired or not authenticated', 401);
            return;
        }

        $this->successResponse([
            'authenticated' => true,
            'user' => [
                'id' => $sessionInfo['user_id'],
                'email' => $sessionInfo['user_email']
            ],
            'session' => [
                'remaining_time' => $sessionInfo['remaining_time'],
                'timeout' => $sessionInfo['timeout']
            ]
        ]);
    }
}
