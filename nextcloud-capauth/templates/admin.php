<?php
/**
 * CapAuth Admin Settings — Nextcloud admin panel template.
 */
script('capauth', 'admin');
?>

<div id="capauth-admin-settings" class="section">
    <h2><?php p($l->t('CapAuth Settings')); ?></h2>

    <p class="settings-hint">
        <?php p($l->t('Configure the CapAuth Verification Service URL.')); ?>
        <?php p($l->t('Run: capauth-service --port 8420 on your server.')); ?>
    </p>

    <form id="capauth-settings-form">
        <div class="form-group">
            <label for="capauth-service-url">
                <?php p($l->t('CapAuth Service URL')); ?>
            </label>
            <input type="url"
                   id="capauth-service-url"
                   name="service_url"
                   value="<?php p($_['serviceUrl']); ?>"
                   placeholder="http://localhost:8420"
                   class="input-lg"/>
            <p class="hint">
                <?php p($l->t('URL of your capauth-service instance. Default: http://localhost:8420')); ?>
            </p>
        </div>

        <div class="form-group">
            <input type="checkbox"
                   id="capauth-require-approval"
                   name="require_approval"
                   <?php if ($_['requireApproval']): ?>checked<?php endif; ?>/>
            <label for="capauth-require-approval">
                <?php p($l->t('Require admin approval for new key enrollments')); ?>
            </label>
            <p class="hint">
                <?php p($l->t('If enabled, new PGP keys must be approved by an admin before first login.')); ?>
            </p>
        </div>

        <div class="capauth-status">
            <button type="button" id="btn-test-connection" class="button">
                <?php p($l->t('Test Connection')); ?>
            </button>
            <span id="capauth-status-msg"></span>
        </div>

        <button type="submit" class="button primary">
            <?php p($l->t('Save')); ?>
        </button>
    </form>
</div>
