<?php
declare(strict_types=1);

namespace OCA\CapAuth\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IConfig;
use OCP\IRequest;

/**
 * Handles saving and retrieving CapAuth admin settings.
 */
class SettingsController extends Controller {
    private IConfig $config;
    private string $appName = 'capauth';

    public function __construct(string $AppName, IRequest $request, IConfig $config) {
        parent::__construct($AppName, $request);
        $this->config = $config;
    }

    /**
     * Return current settings.
     *
     * @return JSONResponse
     */
    public function getSettings(): JSONResponse {
        return new JSONResponse([
            'service_url' => $this->config->getAppValue($this->appName, 'service_url', 'http://localhost:8420'),
            'require_approval' => $this->config->getAppValue($this->appName, 'require_approval', 'false') === 'true',
        ]);
    }

    /**
     * Save admin settings from the admin panel.
     *
     * @return JSONResponse
     */
    public function saveSettings(): JSONResponse {
        $serviceUrl = $this->request->getParam('service_url', '');
        $requireApproval = $this->request->getParam('require_approval', false);

        if (!filter_var($serviceUrl, FILTER_VALIDATE_URL)) {
            return new JSONResponse(['error' => 'Invalid service URL'], 400);
        }

        $this->config->setAppValue($this->appName, 'service_url', rtrim($serviceUrl, '/'));
        $this->config->setAppValue($this->appName, 'require_approval', $requireApproval ? 'true' : 'false');

        return new JSONResponse(['status' => 'ok']);
    }
}
