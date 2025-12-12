<?php

namespace App\Core;

use Exception;

class FincodeClient
{
    private $apiKey;
    private $baseUrl;
    private $envCache = null;

    public function __construct()
    {
        $this->apiKey = $this->resolveApiKey();
        $this->baseUrl = rtrim(
            $this->getEnvValue('FINCODE_BASE_URL', $this->getEnvValue('FINCODE_API_BASE_URL', 'https://api.test.fincode.jp')),
            '/'
        );

        if ($this->apiKey === '') {
            throw new Exception('FINCODE API key (FINCODE_API_KEY/FINCODE_SECRET_KEY) is not configured');
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

    private function resolveApiKey(): string
    {
        $candidates = [
            'FINCODE_API_KEY',
            'FINCODE_SECRET_KEY',
            'FINCODE_PRIVATE_KEY',
            'secret_key',
            'SECRET_KEY',
        ];

        foreach ($candidates as $key) {
            $value = $this->getEnvValue($key, '');
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private function generateIdempotentKey(): string
    {
        try {
            $bytes = random_bytes(16);
            $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
            $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

            return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
        } catch (Exception) {
            return uniqid('fincode_', true);
        }
    }

    private function request(string $method, string $path, $body = null, array $query = []): array
    {
        $url = $this->baseUrl . $path;

        if (!empty($query)) {
            $url .= '?' . http_build_query($query);
        }

        $ch = curl_init($url);
        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
        ];

        $isJsonBody = in_array($method, ['POST', 'PUT', 'PATCH'], true);
        if ($isJsonBody) {
            $headers[] = 'Content-Type: application/json;charset=UTF-8';
            $headers[] = 'idempotent_key: ' . $this->generateIdempotentKey();
            $encodedBody = json_encode($body ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($encodedBody === false) {
                throw new Exception('Failed to encode request body for fincode');
            }
            curl_setopt($ch, CURLOPT_POSTFIELDS, $encodedBody);
        }

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);

        if ($response === false) {
            $error = curl_error($ch);
            throw new Exception('fincode request failed: ' . $error);
        }

        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        $data = json_decode($response, true);
        if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid fincode response format');
        }

        if ($status >= 400) {
            $message = $data['error_message'] ?? ($data['errors'][0]['error_message'] ?? 'fincode API error');
            throw new Exception($message);
        }

        return $data ?? [];
    }

    public function createCustomer(string $name, string $email): array
    {
        return $this->request('POST', '/v1/customers', [
            'name' => $name,
            'email' => $email,
        ]);
    }

    public function getCustomer(string $customerId): array
    {
        return $this->request('GET', "/v1/customers/{$customerId}");
    }

    public function listCards(string $customerId, int $limit = 20): array
    {
        $query = [];
        if ($limit > 0) {
            $query['limit'] = $limit;
        }

        return $this->request('GET', "/v1/customers/{$customerId}/cards", null, $query);
    }

    public function getCard(string $customerId, string $cardId): array
    {
        return $this->request('GET', "/v1/customers/{$customerId}/cards/{$cardId}");
    }

    public function deleteCard(string $customerId, string $cardId): array
    {
        return $this->request('DELETE', "/v1/customers/{$customerId}/cards/{$cardId}");
    }

    public function createCard(string $customerId, string $token): array
    {
        return $this->request('POST', "/v1/customers/{$customerId}/cards", [
            'token' => $token,
            'default_flag' => '1',
        ]);
    }

    public function getPlans(int $limit = 10): array
    {
        $query = [];
        if ($limit > 0) {
            $query['limit'] = $limit;
        }

        return $this->request('GET', '/v1/plans', null, $query);
    }

    public function createSubscription(array $payload): array
    {
        return $this->request('POST', '/v1/subscriptions', $payload);
    }

    public function getSubscription(string $subscriptionId): array
    {
        return $this->request('GET', "/v1/subscriptions/{$subscriptionId}", null, [
            'pay_type' => 'Card',
        ]);
    }

    public function cancelSubscription(string $subscriptionId): array
    {
        return $this->request('DELETE', "/v1/subscriptions/{$subscriptionId}", null, [
            'pay_type' => 'Card',
        ]);
    }

    public function getResults(string $subscriptionId, int $limit = 10): array
    {
        return $this->request('GET', "/v1/subscriptions/{$subscriptionId}/result", null, [
            'pay_type' => 'Card',
            'limit' => $limit,
        ]);
    }
}
