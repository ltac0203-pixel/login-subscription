<?php

namespace App\Controllers;

use App\Core\BaseController;
use App\Core\FincodeClient;
use Exception;

class SubscriptionController extends BaseController
{
    private $envCache = null;

    public function get()
    {
        try {
            $userId = $this->requireAuth();
            if (!$userId) {
                return;
            }

            $subscription = $this->getSubscriptionRow($userId);
            $remoteSubscription = null;
            $results = null;

            if ($subscription && $subscription['fincode_subscription_id']) {
                try {
                    $client = new FincodeClient();
                    $remoteSubscription = $client->getSubscription($subscription['fincode_subscription_id']);
                    $results = $client->getResults($subscription['fincode_subscription_id'], 5);

                    $this->refreshLocalSubscription($userId, $subscription, $remoteSubscription);
                    $subscription = $this->getSubscriptionRow($userId);
                } catch (Exception $e) {
                    error_log('fincode sync failed: ' . $e->getMessage());
                }
            }

            $plan = $this->getPlanConfig([
                'plan_id' => $remoteSubscription['plan_id'] ?? ($subscription['plan_id'] ?? null),
                'plan_name' => $remoteSubscription['plan_name'] ?? null,
                'price' => $remoteSubscription['price'] ?? null,
                'currency' => $remoteSubscription['currency'] ?? null,
            ]);

            $this->successResponse([
                'plan' => $plan,
                'subscription' => $subscription ? $this->formatSubscription($subscription) : null,
                'remote' => $remoteSubscription,
                'results' => $results,
                'public_key' => $this->getEnvValue('FINCODE_PUBLIC_KEY', $this->getEnvValue('public_key', '')),
            ]);
        } catch (Exception $e) {
            error_log('Subscription get error: ' . $e->getMessage());
            $this->errorResponse('サブスクリプション情報の取得に失敗しました', 500);
        }
    }

    public function getCards()
    {
        try {
            $userId = $this->requireAuth();
            if (!$userId) {
                return;
            }

            $subscription = $this->getSubscriptionRow($userId);
            $user = $this->getUser($userId);

            $customerId = $subscription['fincode_customer_id'] ?? ($user['fincode_customer_id'] ?? null);
            if (!$customerId) {
                $this->successResponse([
                    'cards' => [],
                    'customer_id' => null,
                    'message' => '保存済みカードはありません',
                ]);
                return;
            }

            $client = new FincodeClient();
            $cards = [];

            try {
                $listResponse = $client->listCards($customerId, 20);
                $cardItems = $this->extractCardList($listResponse);
                foreach ($cardItems as $cardRow) {
                    $normalized = $this->normalizeCard($cardRow);
                    if ($normalized) {
                        $cards[] = $normalized;
                    }
                }
            } catch (Exception $e) {
                error_log('fincode card list fetch failed: ' . $e->getMessage());
            }

            $knownCardIds = [];
            if ($subscription && !empty($subscription['fincode_card_id'])) {
                $knownCardIds[] = $subscription['fincode_card_id'];
            }
            $knownCardIds = array_values(array_unique(array_filter($knownCardIds)));

            if (empty($cards) && !empty($knownCardIds)) {
                foreach ($knownCardIds as $cardId) {
                    try {
                        $cardResponse = $client->getCard($customerId, $cardId);
                        $normalized = $this->normalizeCard($cardResponse, $cardId);
                        if ($normalized) {
                            $cards[] = $normalized;
                        }
                    } catch (Exception $e) {
                        error_log('fincode card fetch failed: ' . $e->getMessage());
                    }
                }
            }

            $this->successResponse([
                'cards' => $cards,
                'customer_id' => $customerId,
            ]);
        } catch (Exception $e) {
            error_log('Subscription cards fetch error: ' . $e->getMessage());
            $this->errorResponse('カード情報の取得に失敗しました', 500);
        }
    }

    public function getPlans()
    {
        try {
            $userId = $this->requireAuth();
            if (!$userId) {
                return;
            }

            $response = $this->fetchPlansFromFincode();

            $planItems = $this->extractPlanList($response);
            $plans = array_values(array_filter(array_map(function ($plan) {
                if (!is_array($plan)) {
                    return null;
                }

                $id = $plan['id'] ?? $plan['plan_id'] ?? null;
                if (!$id) {
                    return null;
                }

                return [
                    'id' => $id,
                    'name' => $plan['name'] ?? $plan['plan_name'] ?? null,
                    'price' => $plan['price'] ?? $plan['amount'] ?? null,
                    'currency' => $plan['currency'] ?? $plan['currency_code'] ?? null,
                ];
            }, $planItems)));

            if (empty($plans)) {
                $fallback = $this->getPlanConfig();
                if (!empty($fallback['id'])) {
                    $plans[] = $fallback;
                }
            }

            $this->successResponse([
                'plans' => $plans,
            ]);
        } catch (Exception $e) {
            error_log('Subscription plan fetch error: ' . $e->getMessage());
            $this->errorResponse('プラン情報の取得に失敗しました', 500);
        }
    }

    private function fetchPlansFromFincode(): array
    {
        try {
            $client = new FincodeClient();
            return $client->getPlans(10);
        } catch (Exception $e) {
            error_log('FincodeClient getPlans failed, fallback to direct request: ' . $e->getMessage());
        }

        $apiKey = $this->getEnvValue('FINCODE_API_KEY', $this->getEnvValue('FINCODE_SECRET_KEY', $this->getEnvValue('secret_key', '')));
        if ($apiKey === '') {
            throw new Exception('FINCODE API key is not configured');
        }

        $baseUrl = rtrim($this->getEnvValue('FINCODE_BASE_URL', $this->getEnvValue('FINCODE_API_BASE_URL', 'https://api.test.fincode.jp')), '/');
        $endpoint = '/v1/plans';
        $headers = [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json;charset=UTF-8',
            'Accept: application/json',
        ];

        $queryParams = [
            'limit' => 10,
        ];

        $ch = curl_init($baseUrl . $endpoint . '?' . http_build_query($queryParams));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');

        $response = curl_exec($ch);
        if ($response === false) {
            $error = curl_error($ch);
            throw new Exception('fincode plan request failed: ' . $error);
        }

        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        $data = json_decode($response, true);
        if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid fincode plan response format');
        }

        if ($status >= 400) {
            $message = $data['error_message'] ?? ($data['errors'][0]['error_message'] ?? 'fincode API error');
            throw new Exception($message);
        }

        return $data;
    }

    public function subscribe()
    {
        try {
            $userId = $this->requireAuth();
            if (!$userId) {
                return;
            }

            $input = $this->getRequestBody();
            if ($input === null) {
                $this->errorResponse('Invalid request payload');
                return;
            }

            $planId = $input['plan_id'] ?? $this->getEnvValue('FINCODE_PLAN_ID', '');
            if (!$planId) {
                $this->errorResponse('プランIDが設定されていません');
                return;
            }

            $existing = $this->getSubscriptionRow($userId);
            if ($existing && $existing['status'] === 'active') {
                $this->errorResponse('既に有効なサブスクリプションが存在します');
                return;
            }

            $client = new FincodeClient();
            $user = $this->getUser($userId);
            $userEmail = $user['email'] ?? '';
            $customerName = $input['customer_name'] ?? ($userEmail ?: 'Tsunagi User ' . $userId);

            $customerId = $existing['fincode_customer_id'] ?? ($user['fincode_customer_id'] ?? null);
            if ($customerId) {
                try {
                    $client->getCustomer($customerId);
                } catch (Exception $e) {
                    error_log('fincode customer fetch failed, recreate: ' . $e->getMessage());
                    $customerId = null;
                }
            }
            if (!$customerId) {
                $customerResponse = $client->createCustomer($customerName, $userEmail);
                $customerId = $customerResponse['id'] ?? $customerResponse['customer_id'] ?? null;
                if ($customerId && empty($user['fincode_customer_id'])) {
                    $this->updateUserFincodeCustomerId($userId, $customerId);
                }
            }

            if (!$customerId) {
                $this->errorResponse('顧客の作成に失敗しました', 500);
                return;
            }

            $cardToken = isset($input['card_token']) ? trim((string)$input['card_token']) : '';
            $cardId = $existing['fincode_card_id'] ?? null;

            if ($cardToken === '' && !$cardId) {
                $this->errorResponse('card_tokenを指定してください');
                return;
            }

            if ($cardToken !== '') {
                $cardResponse = $client->createCard($customerId, $cardToken);
                $cardId = $cardResponse['id'] ?? $cardResponse['card_id'] ?? null;
            }

            if (!$cardId) {
                $this->errorResponse('カード登録に失敗しました', 500);
                return;
            }

            $startDate = $this->formatDateForFincode($input['start_date'] ?? date('Y-m-d'));

            $subscriptionResponse = $client->createSubscription([
                'pay_type' => 'Card',
                'plan_id' => $planId,
                'customer_id' => $customerId,
                'card_id' => $cardId,
                'start_date' => $startDate,
            ]);

            $subscriptionId = $subscriptionResponse['id'] ?? $subscriptionResponse['subscription_id'] ?? null;
            $status = $subscriptionResponse['status'] ?? $subscriptionResponse['subscription_status'] ?? 'active';
            $nextChargeDate = $subscriptionResponse['next_charge_date'] ?? ($subscriptionResponse['next_billing_date'] ?? null);

            $record = [
                'plan_id' => $planId,
                'fincode_customer_id' => $customerId,
                'fincode_card_id' => $cardId,
                'fincode_subscription_id' => $subscriptionId,
                'status' => $status,
                'start_date' => $this->formatDateForDb($startDate),
                'next_charge_date' => $this->formatDateForDb($nextChargeDate),
                'cancel_at' => null,
                'raw_payload' => json_encode($subscriptionResponse, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];

            $this->persistSubscription($userId, $record, $existing);

            $this->successResponse([
                'message' => 'サブスクリプションを開始しました',
                'subscription' => $this->formatSubscription($this->getSubscriptionRow($userId)),
                'fincode_response' => $subscriptionResponse,
            ], 201);
        } catch (Exception $e) {
            error_log('Subscription create error: ' . $e->getMessage());
            $this->errorResponse('サブスクリプション登録に失敗しました', 500);
        }
    }

    public function registerCard()
    {
        try {
            $userId = $this->requireAuth();
            if (!$userId) {
                return;
            }

            $input = $this->getRequestBody();
            if ($input === null) {
                $this->errorResponse('Invalid request payload');
                return;
            }

            if (!$this->validateRequired($input, ['card_token'])) {
                return;
            }

            $existing = $this->getSubscriptionRow($userId);

            $client = new FincodeClient();
            $user = $this->getUser($userId);
            $userEmail = $user['email'] ?? '';
            $customerName = $input['customer_name'] ?? ($userEmail ?: 'Tsunagi User ' . $userId);

            $customerId = $existing['fincode_customer_id'] ?? ($user['fincode_customer_id'] ?? null);
            if ($customerId) {
                try {
                    $client->getCustomer($customerId);
                } catch (Exception $e) {
                    error_log('fincode customer fetch failed, recreate: ' . $e->getMessage());
                    $customerId = null;
                }
            }
            if (!$customerId) {
                $customerResponse = $client->createCustomer($customerName, $userEmail);
                $customerId = $customerResponse['id'] ?? $customerResponse['customer_id'] ?? null;
                if ($customerId && empty($user['fincode_customer_id'])) {
                    $this->updateUserFincodeCustomerId($userId, $customerId);
                }
            }

            if (!$customerId) {
                $this->errorResponse('顧客の作成に失敗しました', 500);
                return;
            }

            $cardResponse = $client->createCard($customerId, $input['card_token']);
            $cardId = $cardResponse['id'] ?? $cardResponse['card_id'] ?? null;

            if (!$cardId) {
                $this->errorResponse('カード登録に失敗しました', 500);
                return;
            }

            $record = [
                'plan_id' => $existing['plan_id'] ?? $this->getEnvValue('FINCODE_PLAN_ID', 'card_only'),
                'fincode_customer_id' => $customerId,
                'fincode_card_id' => $cardId,
                'fincode_subscription_id' => $existing['fincode_subscription_id'] ?? null,
                'status' => $existing['status'] ?? 'card_registered',
                'start_date' => $existing['start_date'] ?? null,
                'next_charge_date' => $existing['next_charge_date'] ?? null,
                'cancel_at' => $existing['cancel_at'] ?? null,
                'raw_payload' => json_encode($cardResponse, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];

            $this->persistSubscription($userId, $record, $existing);

            $this->successResponse([
                'message' => 'カードを登録しました',
                'card_id' => $cardId,
                'customer_id' => $customerId,
                'subscription' => $this->formatSubscription($this->getSubscriptionRow($userId)),
                'fincode_response' => $cardResponse,
            ], 201);
        } catch (Exception $e) {
            error_log('Subscription card register error: ' . $e->getMessage());
            $this->errorResponse('カード登録に失敗しました', 500);
        }
    }

    public function deleteCard(array $params)
    {
        try {
            $userId = $this->requireAuth();
            if (!$userId) {
                return;
            }

            $cardId = $params['cardId'] ?? ($params['card_id'] ?? null);
            if (!$cardId) {
                $this->errorResponse('cardId を指定してください', 400);
                return;
            }

            $subscription = $this->getSubscriptionRow($userId);
            $user = $this->getUser($userId);
            $customerId = $subscription['fincode_customer_id'] ?? ($user['fincode_customer_id'] ?? null);

            if (!$customerId) {
                $this->errorResponse('カード情報が存在しません', 404);
                return;
            }

            $client = new FincodeClient();
            $response = $client->deleteCard($customerId, $cardId);

            if ($subscription && ($subscription['fincode_card_id'] === $cardId)) {
                $record = [
                    'plan_id' => $subscription['plan_id'],
                    'fincode_customer_id' => $subscription['fincode_customer_id'],
                    'fincode_card_id' => null,
                    'fincode_subscription_id' => $subscription['fincode_subscription_id'],
                    'status' => $subscription['status'],
                    'start_date' => $subscription['start_date'],
                    'next_charge_date' => $subscription['next_charge_date'],
                    'cancel_at' => $subscription['cancel_at'],
                    'raw_payload' => json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ];

                $this->persistSubscription($userId, $record, $subscription);
            }

            $this->successResponse([
                'message' => 'カードを削除しました',
                'card_id' => $cardId,
                'customer_id' => $customerId,
                'fincode_response' => $response,
                'subscription' => $this->formatSubscription($this->getSubscriptionRow($userId)),
            ]);
        } catch (Exception $e) {
            error_log('Subscription card delete error: ' . $e->getMessage());
            $this->errorResponse('カード削除に失敗しました', 500);
        }
    }

    public function cancel()
    {
        try {
            $userId = $this->requireAuth();
            if (!$userId) {
                return;
            }

            $subscription = $this->getSubscriptionRow($userId);
            if (!$subscription || !$subscription['fincode_subscription_id']) {
                $this->errorResponse('有効なサブスクリプションが見つかりません', 404);
                return;
            }

            $client = new FincodeClient();
            $response = $client->cancelSubscription($subscription['fincode_subscription_id']);

            $record = [
                'plan_id' => $subscription['plan_id'],
                'fincode_customer_id' => $subscription['fincode_customer_id'],
                'fincode_card_id' => $subscription['fincode_card_id'],
                'fincode_subscription_id' => $subscription['fincode_subscription_id'],
                'status' => 'canceled',
                'start_date' => $subscription['start_date'],
                'next_charge_date' => null,
                'cancel_at' => date('Y-m-d'),
                'raw_payload' => json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];

            $this->persistSubscription($userId, $record, $subscription);

            $this->successResponse([
                'message' => 'サブスクリプションを解約しました',
                'subscription' => $this->formatSubscription($this->getSubscriptionRow($userId)),
                'fincode_response' => $response,
            ]);
        } catch (Exception $e) {
            error_log('Subscription cancel error: ' . $e->getMessage());
            $this->errorResponse('サブスクリプション解約に失敗しました', 500);
        }
    }

    private function getEnvValue(string $key, $default = null)
    {
        $value = getenv($key);
        if ($value !== false && $value !== '') {
            return $value;
        }

        if ($this->envCache === null) {
            $this->envCache = [];
            $envFile = __DIR__ . '/../../.env';
            if (file_exists($envFile)) {
                $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                foreach ($lines as $line) {
                    if (strpos($line, '=') !== false && !str_starts_with($line, '//')) {
                        [$k, $v] = explode('=', $line, 2);
                        $this->envCache[trim($k)] = trim($v);
                    }
                }
            }
        }

        return $this->envCache[$key] ?? $default;
    }

    private function extractPlanList($response): array
    {
        if (!is_array($response)) {
            return [];
        }

        foreach (['plans', 'items', 'data', 'list'] as $key) {
            if (isset($response[$key]) && is_array($response[$key])) {
                return $response[$key];
            }
        }

        if ($response && array_values($response) === $response) {
            return $response;
        }

        return [];
    }

    private function getPlanConfig(array $fallback = []): array
    {
        $planId = $this->getEnvValue('FINCODE_PLAN_ID', '');
        if ($planId === '' && isset($fallback['plan_id']) && $fallback['plan_id']) {
            $planId = $fallback['plan_id'];
        }

        $name = $this->getEnvValue('SUBSCRIPTION_PLAN_NAME', '');
        if ($name === '' && isset($fallback['plan_name']) && $fallback['plan_name']) {
            $name = $fallback['plan_name'];
        }

        $price = $this->getEnvValue('SUBSCRIPTION_PLAN_PRICE', '');
        if ($price === '' && isset($fallback['price']) && $fallback['price']) {
            $price = $fallback['price'];
        }

        $currency = $this->getEnvValue('SUBSCRIPTION_PLAN_CURRENCY', 'JPY');
        if (isset($fallback['currency']) && $fallback['currency']) {
            $currency = $fallback['currency'];
        }

        return [
            'id' => $planId,
            'name' => $name !== '' ? $name : 'Standard Plan',
            'price' => $price,
            'currency' => $currency,
        ];
    }

    private function getSubscriptionRow(int $userId): ?array
    {
        $stmt = $this->db->query('SELECT * FROM subscriptions WHERE user_id = ?', [$userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    private function getUser(int $userId): ?array
    {
        $stmt = $this->db->query('SELECT id, email, fincode_customer_id FROM users WHERE id = ?', [$userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    private function updateUserFincodeCustomerId(int $userId, string $customerId): void
    {
        $this->db->query(
            'UPDATE users SET fincode_customer_id = ? WHERE id = ? AND (fincode_customer_id IS NULL OR fincode_customer_id = \'\')',
            [$customerId, $userId]
        );
    }

    private function persistSubscription(int $userId, array $record, ?array $existing): void
    {
        if ($existing) {
            $this->db->query(
                'UPDATE subscriptions SET plan_id = ?, fincode_customer_id = ?, fincode_card_id = ?, fincode_subscription_id = ?, status = ?, start_date = ?, next_charge_date = ?, cancel_at = ?, raw_payload = ?, updated_at = NOW() WHERE user_id = ?',
                [
                    $record['plan_id'],
                    $record['fincode_customer_id'],
                    $record['fincode_card_id'],
                    $record['fincode_subscription_id'],
                    $record['status'],
                    $record['start_date'],
                    $record['next_charge_date'],
                    $record['cancel_at'],
                    $record['raw_payload'],
                    $userId,
                ]
            );
        } else {
            $this->db->query(
                'INSERT INTO subscriptions (user_id, plan_id, fincode_customer_id, fincode_card_id, fincode_subscription_id, status, start_date, next_charge_date, cancel_at, raw_payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
                [
                    $userId,
                    $record['plan_id'],
                    $record['fincode_customer_id'],
                    $record['fincode_card_id'],
                    $record['fincode_subscription_id'],
                    $record['status'],
                    $record['start_date'],
                    $record['next_charge_date'],
                    $record['cancel_at'],
                    $record['raw_payload'],
                ]
            );
        }
    }

    private function formatSubscription(?array $subscription): ?array
    {
        if (!$subscription) {
            return null;
        }

        return [
            'plan_id' => $subscription['plan_id'],
            'status' => $subscription['status'],
            'start_date' => $subscription['start_date'],
            'next_charge_date' => $subscription['next_charge_date'],
            'cancel_at' => $subscription['cancel_at'],
            'fincode_subscription_id' => $subscription['fincode_subscription_id'],
            'fincode_customer_id' => $subscription['fincode_customer_id'],
            'fincode_card_id' => $subscription['fincode_card_id'],
        ];
    }

    private function normalizeCard($card, ?string $fallbackId = null): ?array
    {
        if (!is_array($card)) {
            return null;
        }

        $id = $card['id'] ?? $card['card_id'] ?? $fallbackId ?? null;
        $id = is_string($id) ? trim($id) : null;
        if (!$id) {
            return null;
        }

        $brand = $card['brand'] ?? ($card['card_brand'] ?? ($card['brand_code'] ?? null));

        $cardNo = $card['masked_card_no'] ?? ($card['card_no'] ?? ($card['card_number'] ?? null));
        $lastFour = null;
        if (is_string($cardNo) && $cardNo !== '') {
            $digits = preg_replace('/\D/', '', $cardNo);
            if ($digits !== '') {
                $lastFour = substr($digits, -4);
            }
        } elseif (isset($card['last4'])) {
            $digits = preg_replace('/\D/', '', (string)$card['last4']);
            $lastFour = $digits !== '' ? substr($digits, -4) : null;
        }

        $expireMonth = $card['expire_month'] ?? $card['expiration_month'] ?? null;
        $expireYear = $card['expire_year'] ?? $card['expiration_year'] ?? null;
        $expire = null;
        if ($expireMonth !== null && $expireYear !== null) {
            $expire = sprintf('%02d/%s', (int)$expireMonth, substr((string)$expireYear, -2));
        } elseif (isset($card['expire'])) {
            $expire = (string)$card['expire'];
        }

        return [
            'id' => $id,
            'brand' => $brand,
            'card_no' => $cardNo,
            'masked_card_no' => $cardNo,
            'last_four' => $lastFour,
            'expire' => $expire,
            'expire_month' => $expireMonth,
            'expire_year' => $expireYear,
            'holder_name' => $card['holder_name'] ?? null,
            'fingerprint' => $card['fingerprint'] ?? null,
            'default_flag' => $card['default_flag'] ?? null,
            'card_status' => $card['status'] ?? ($card['card_status'] ?? null),
            'raw' => $card,
        ];
    }

    private function formatDateForFincode(?string $date): ?string
    {
        if (!$date) {
            return null;
        }

        $timestamp = strtotime($date);
        if ($timestamp === false) {
            return null;
        }

        return date('Y/m/d', $timestamp);
    }

    private function formatDateForDb(?string $date): ?string
    {
        if (!$date) {
            return null;
        }

        $timestamp = strtotime($date);
        if ($timestamp === false) {
            return null;
        }

        return date('Y-m-d', $timestamp);
    }

    private function refreshLocalSubscription(int $userId, array $local, array $remote): void
    {
        if (!$remote) {
            return;
        }

        $status = $remote['status'] ?? $remote['subscription_status'] ?? $local['status'];
        $nextCharge = $remote['next_charge_date'] ?? ($remote['next_billing_date'] ?? $local['next_charge_date']);

        $updated = [
            'plan_id' => $local['plan_id'],
            'fincode_customer_id' => $local['fincode_customer_id'],
            'fincode_card_id' => $local['fincode_card_id'],
            'fincode_subscription_id' => $local['fincode_subscription_id'],
            'status' => $status,
            'start_date' => $local['start_date'],
            'next_charge_date' => $this->formatDateForDb($nextCharge),
            'cancel_at' => $local['cancel_at'],
            'raw_payload' => json_encode($remote, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];

        $this->persistSubscription($userId, $updated, $local);
    }

    private function extractCardList($response): array
    {
        if (!is_array($response)) {
            return [];
        }

        foreach (['cards', 'items', 'data', 'list'] as $key) {
            if (isset($response[$key]) && is_array($response[$key])) {
                return $response[$key];
            }
        }

        if ($response && array_values($response) === $response) {
            return $response;
        }

        return [];
    }
}
