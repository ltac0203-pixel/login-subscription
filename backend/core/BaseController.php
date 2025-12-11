<?php

namespace App\Core;

use App\Core\SessionManager;

abstract class BaseController
{
    protected $db;

    public function __construct()
    {
        $this->db = \Database::getInstance();
    }

    protected function requireAuth()
    {
        if (!SessionManager::isAuthenticated()) {
            http_response_code(401);
            echo json_encode(['error' => 'Authentication required']);
            return false;
        }
        return $_SESSION['user_id'];
    }

    protected function jsonResponse($data, $statusCode = 200)
    {
        http_response_code($statusCode);
        echo json_encode($data);
    }

    protected function errorResponse($message, $statusCode = 400)
    {
        $this->jsonResponse(['error' => $message], $statusCode);
    }

    protected function successResponse($data = [], $statusCode = 200)
    {
        $this->jsonResponse(array_merge(['success' => true], $data), $statusCode);
    }

    protected function getRequestBody()
    {
        $input = file_get_contents('php://input');

        if ($input === false || trim($input) === '') {
            return [];
        }

        $decoded = json_decode($input, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return null;
        }

        return $decoded;
    }

    protected function validateRequired($input, $required)
    {
        if (!is_array($input)) {
            $this->errorResponse('Invalid request payload');
            return false;
        }

        foreach ($required as $field) {
            if (!isset($input[$field])) {
                $this->errorResponse("$field is required");
                return false;
            }

            if (is_string($input[$field])) {
                if (trim($input[$field]) === '') {
                    $this->errorResponse("$field is required");
                    return false;
                }
            } elseif (empty($input[$field])) {
                $this->errorResponse("$field is required");
                return false;
            }
        }
        return true;
    }
}
