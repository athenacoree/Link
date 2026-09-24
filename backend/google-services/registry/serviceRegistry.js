/**
 * Service Registry for Google Services Engine
 */

class ServiceRegistry {
  constructor() {
    this.services = new Map();
  }

  register(serviceName, adapter) {
    this.services.set(serviceName, adapter);
  }

  get(serviceName) {
    return this.services.get(serviceName);
  }

  getAll() {
    return Array.from(this.services.entries()).map(([name, adapter]) => ({
      name,
      adapter
    }));
  }

  async checkAllStatus() {
    const results = {};
    for (const [name, adapter] of this.services.entries()) {
      try {
        const statusInfo = await adapter.checkStatus();
        results[name] = statusInfo;
      } catch (err) {
        results[name] = {
          status: 'ERROR',
          reason: err.message,
          billingRequired: false,
          freeTier: true
        };
      }
    }
    return results;
  }
}

const registryInstance = new ServiceRegistry();
module.exports = registryInstance;
