<?php

class Router
{
    private $routes = [];

    public function get($path, $controller, $method)
    {
        $this->addRoute('GET', $path, $controller, $method);
    }

    public function post($path, $controller, $method)
    {
        $this->addRoute('POST', $path, $controller, $method);
    }

    public function delete($path, $controller, $method)
    {
        $this->addRoute('DELETE', $path, $controller, $method);
    }

    private function addRoute($httpMethod, $path, $controller, $method)
    {
        $this->routes[] = [
            'method' => $httpMethod,
            'path' => $path,
            'controller' => $controller,
            'action' => $method
        ];
    }

    public function handleRequest()
    {
        $requestMethod = $_SERVER['REQUEST_METHOD'];
        $requestUri = $_SERVER['REQUEST_URI'];

        $requestUri = strtok($requestUri, '?');

        foreach ($this->routes as $route) {
            if ($route['method'] === $requestMethod) {
                $pattern = $this->convertPathToRegex($route['path']);
                if (preg_match($pattern, $requestUri, $matches)) {
                    $params = $this->extractParams($route['path'], $requestUri);
                    $this->callController($route['controller'], $route['action'], $params);
                    return;
                }
            }
        }

        http_response_code(404);
        echo json_encode(['error' => 'Route not found']);
    }

    private function convertPathToRegex($path)
    {
        $pattern = preg_replace('/\{([^}]+)\}/', '([^/]+)', $path);
        return '#^' . $pattern . '$#';
    }

    private function extractParams($routePath, $requestUri)
    {
        $params = [];
        $routeParts = explode('/', trim($routePath, '/'));
        $uriParts = explode('/', trim($requestUri, '/'));

        for ($i = 0; $i < count($routeParts); $i++) {
            if (isset($routeParts[$i]) && preg_match('/\{([^}]+)\}/', $routeParts[$i], $matches)) {
                $paramName = $matches[1];
                $params[$paramName] = $uriParts[$i] ?? null;
            }
        }

        return $params;
    }

    private function callController($controllerName, $actionName, $params = [])
    {
        try {
            $fullControllerName = 'App\\Controllers\\' . $controllerName;

            if (!class_exists($fullControllerName)) {
                throw new Exception("Controller $fullControllerName not found");
            }

            $controller = new $fullControllerName();

            if (!method_exists($controller, $actionName)) {
                throw new Exception("Method $actionName not found in $controllerName");
            }

            $controller->$actionName($params);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
}
