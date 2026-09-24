/**
 * Google Cloud Config & Billing Detection
 */

function getGoogleCloudConfig() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'linkai-3eda1';
  const hasBillingEnabled = process.env.GOOGLE_CLOUD_BILLING_ENABLED === 'true';

  return {
    projectId,
    hasBillingEnabled,
    costMode: 'FREE_FIRST'
  };
}

module.exports = {
  getGoogleCloudConfig
};
