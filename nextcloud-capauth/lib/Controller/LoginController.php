<?php
declare(strict_types=1);

namespace OCA\CapAuth\Controller;

use OCA\CapAuth\Service\CapAuthService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\ISession;
use OCP\IUserManager;
use OCP\IUserSession;
use Psr\Log\LoggerInterface;

/**
 * Controller handling the CapAuth login flow in Nextcloud.
 *
 * Flow:
 *   1. User clicks "Login with CapAuth" → showLogin() renders the JS UI
 *   2. JS fetches fingerprint from browser extension or prompts for it
 *   3. JS POST /challenge → challenge() proxies to CapAuth service
 *   4. User signs the nonce with their PGP key (extension/CLI)
 *   5. JS POST /verify → verify() proxies to CapAuth service
 *   6. On success, we create/find the Nextcloud user and log them in
 */
class LoginController extends Controller {
    private CapAuthService $capauth;
    private IUserManager $userManager;
    private IUserSession $userSession;
    private ISession $session;
    private LoggerInterface $logger;

    public function __construct(
        string $appName,
        IRequest $request,
        CapAuthService $capauth,
        IUserManager $userManager,
        IUserSession $userSession,
        ISession $session,
        LoggerInterface $logger
    ) {
        parent::__construct($appName, $request);
        $this->capauth = $capauth;
        $this->userManager = $userManager;
        $this->userSession = $userSession;
        $this->session = $session;
        $this->logger = $logger;
    }

    /**
     * Render the CapAuth login page.
     *
     * @NoAdminRequired
     * @PublicPage
     * @NoCSRFRequired
     */
    public function showLogin(): TemplateResponse {
        return new TemplateResponse('capauth', 'login', [
            'serviceUrl' => $this->capauth->getServiceUrl(),
        ], 'guest');
    }

    /**
     * Proxy a challenge request to the CapAuth service.
     *
     * @NoAdminRequired
     * @PublicPage
     * @NoCSRFRequired
     */
    public function challenge(): JSONResponse {
        $fingerprint = $this->request->getParam('fingerprint', '');
        $clientNonce = $this->request->getParam('client_nonce', '');

        if (strlen($fingerprint) !== 40) {
            return new JSONResponse([
                'error' => 'invalid_fingerprint',
                'error_description' => 'Provide a 40-character PGP fingerprint.',
            ], 400);
        }

        try {
            $challenge = $this->capauth->getChallenge($fingerprint, $clientNonce);
            // Store challenge in session for verify step
            $this->session->set('capauth_challenge', json_encode($challenge));
            $this->session->set('capauth_fingerprint', $fingerprint);
            return new JSONResponse($challenge);
        } catch (\Exception $e) {
            $this->logger->error('CapAuth challenge failed: ' . $e->getMessage());
            return new JSONResponse([
                'error' => 'service_error',
                'error_description' => 'CapAuth service unavailable.',
            ], 502);
        }
    }

    /**
     * Proxy a verify request and create the Nextcloud session.
     *
     * @NoAdminRequired
     * @PublicPage
     * @NoCSRFRequired
     */
    public function verify(): JSONResponse {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!$body || !isset($body['fingerprint'])) {
            return new JSONResponse(['error' => 'invalid_request'], 400);
        }

        try {
            $result = $this->capauth->verify($body);
        } catch (\Exception $e) {
            $this->logger->error('CapAuth verify failed: ' . $e->getMessage());
            return new JSONResponse([
                'error' => 'authentication_failed',
                'error_description' => $e->getMessage(),
            ], 401);
        }

        $fingerprint = $result['fingerprint'];
        $claims = $result['oidc_claims'] ?? [];

        // Use fingerprint as the Nextcloud user ID (stable, unique, no PII)
        $userId = 'capauth-' . substr($fingerprint, 0, 16);
        $displayName = $claims['name'] ?? 'CapAuth ' . substr($fingerprint, 0, 8);
        $email = $claims['email'] ?? '';

        // Find or create the Nextcloud user
        $user = $this->userManager->get($userId);
        if ($user === null) {
            // Auto-provision: create user with no password (passwordless!)
            $user = $this->userManager->createUser($userId, bin2hex(random_bytes(32)));
            if ($user === null) {
                return new JSONResponse([
                    'error' => 'user_creation_failed',
                    'error_description' => 'Could not create Nextcloud user.',
                ], 500);
            }
            $this->logger->info("CapAuth: created new Nextcloud user $userId");
        }

        // Update display fields from client claims (not persisted permanently)
        $user->setDisplayName($displayName);
        if ($email) {
            $user->setEMailAddress($email);
        }

        // Log the user in
        $this->userSession->setUser($user);
        $this->session->set('capauth_authenticated', true);
        $this->session->set('capauth_fingerprint', $fingerprint);

        $this->logger->info("CapAuth: user $userId authenticated via fingerprint " . substr($fingerprint, 0, 8));

        return new JSONResponse([
            'authenticated' => true,
            'user_id' => $userId,
            'display_name' => $displayName,
            'redirect' => '/',
        ]);
    }
}
