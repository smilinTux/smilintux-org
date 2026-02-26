<?php
declare(strict_types=1);

namespace OCA\CapAuth\Settings;

use OCP\AppFramework\Http\TemplateResponse;
use OCP\IConfig;
use OCP\Settings\ISettings;

/**
 * Admin settings panel for the CapAuth app.
 *
 * Allows the Nextcloud admin to configure:
 *   - CapAuth service URL (default: http://localhost:8420)
 *   - Whether to require admin approval for new key enrollments
 */
class AdminSettings implements ISettings {
    private IConfig $config;
    private string $appName = 'capauth';

    public function __construct(IConfig $config) {
        $this->config = $config;
    }

    /**
     * Render the admin settings form.
     *
     * @return TemplateResponse
     */
    public function getForm(): TemplateResponse {
        $serviceUrl = $this->config->getAppValue(
            $this->appName,
            'service_url',
            'http://localhost:8420'
        );
        $requireApproval = $this->config->getAppValue(
            $this->appName,
            'require_approval',
            'false'
        );

        return new TemplateResponse('capauth', 'admin', [
            'serviceUrl' => $serviceUrl,
            'requireApproval' => $requireApproval === 'true',
        ]);
    }

    public function getSection(): string {
        return 'security';
    }

    public function getPriority(): int {
        return 50;
    }
}
