<?php
declare(strict_types=1);

namespace OCA\CapAuth\Service;

use OCP\Http\Client\IClientService;
use OCP\IConfig;
use Psr\Log\LoggerInterface;

/**
 * Service layer for communicating with the CapAuth Verification Service.
 *
 * All PGP verification happens in the external Python service.
 * This PHP code is a thin proxy that relays challenge/verify requests
 * and maps the OIDC claims response to a Nextcloud user session.
 */
class CapAuthService {
    private IClientService $httpClient;
    private IConfig $config;
    private LoggerInterface $logger;
    private string $appName = 'capauth';

    public function __construct(
        IClientService $httpClient,
        IConfig $config,
        LoggerInterface $logger
    ) {
        $this->httpClient = $httpClient;
        $this->config = $config;
        $this->logger = $logger;
    }

    /**
     * Get the configured CapAuth service URL.
     */
    public function getServiceUrl(): string {
        return $this->config->getAppValue(
            $this->appName,
            'service_url',
            'http://localhost:8420'
        );
    }

    /**
     * Request a challenge nonce from the CapAuth service.
     *
     * @param string $fingerprint Client's 40-char PGP fingerprint.
     * @param string $clientNonce Base64-encoded client nonce.
     * @return array Challenge response from the service.
     * @throws \Exception On network or service error.
     */
    public function getChallenge(string $fingerprint, string $clientNonce): array {
        $client = $this->httpClient->newClient();
        $serviceUrl = $this->getServiceUrl();

        $response = $client->post("$serviceUrl/capauth/v1/challenge", [
            'json' => [
                'capauth_version' => '1.0',
                'fingerprint' => $fingerprint,
                'client_nonce' => $clientNonce,
            ],
            'timeout' => 10,
        ]);

        $body = json_decode($response->getBody(), true);
        if ($body === null) {
            throw new \Exception('Invalid JSON from CapAuth service');
        }

        return $body;
    }

    /**
     * Verify a signed authentication response via the CapAuth service.
     *
     * @param array $signedResponse The complete signed response from the client.
     * @return array Verification result with OIDC claims.
     * @throws \Exception On verification failure or network error.
     */
    public function verify(array $signedResponse): array {
        $client = $this->httpClient->newClient();
        $serviceUrl = $this->getServiceUrl();

        $response = $client->post("$serviceUrl/capauth/v1/verify", [
            'json' => $signedResponse,
            'timeout' => 15,
        ]);

        $statusCode = $response->getStatusCode();
        $body = json_decode($response->getBody(), true);

        if ($statusCode !== 200) {
            $error = $body['error'] ?? 'unknown_error';
            $desc = $body['error_description'] ?? 'Authentication failed';
            throw new \Exception("CapAuth verification failed ($error): $desc");
        }

        if ($body === null || !isset($body['authenticated'])) {
            throw new \Exception('Invalid verification response from CapAuth service');
        }

        return $body;
    }

    /**
     * Check the CapAuth service health.
     *
     * @return array Service status.
     */
    public function getStatus(): array {
        try {
            $client = $this->httpClient->newClient();
            $serviceUrl = $this->getServiceUrl();
            $response = $client->get("$serviceUrl/capauth/v1/status", ['timeout' => 5]);
            return json_decode($response->getBody(), true) ?? [];
        } catch (\Exception $e) {
            $this->logger->error('CapAuth service health check failed: ' . $e->getMessage());
            return ['healthy' => false, 'error' => $e->getMessage()];
        }
    }
}
