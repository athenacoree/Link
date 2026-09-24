class GoogleMapsAdapter {
  constructor() {
    this.name = 'maps';
  }

  async checkStatus() {
    const isEnabled = process.env.GOOGLE_MAPS_ENABLED === 'true';
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!isEnabled) {
      return {
        status: 'CONFIG_REQUIRED',
        reason: 'Maps disabled by default (GOOGLE_MAPS_ENABLED=false)',
        billingRequired: true,
        freeTier: true,
        lastCheck: new Date().toISOString()
      };
    }

    if (!apiKey) {
      return {
        status: 'CONFIG_REQUIRED',
        reason: 'GOOGLE_MAPS_API_KEY required when GOOGLE_MAPS_ENABLED=true',
        billingRequired: true,
        freeTier: true,
        lastCheck: new Date().toISOString()
      };
    }

    return {
      status: 'CONFIGURED',
      reason: 'Maps, Places, Geocoding, Routes & Street View operational',
      billingRequired: true,
      freeTier: true,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = new GoogleMapsAdapter();
