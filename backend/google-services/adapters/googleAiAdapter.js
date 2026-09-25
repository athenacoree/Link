class GoogleAiAdapter {
  constructor() {
    this.name = 'gemini';
  }

  async checkStatus() {
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    const model = (process.env.GEMINI_MODEL || '').trim();
    const configured = Boolean(geminiKey && model);

    return {
      status: configured ? 'CONFIGURED' : 'CONFIG_REQUIRED',
      reason: configured
        ? `Gemini API configurado (Model: ${model})`
        : (!model ? 'GEMINI_MODEL variable de entorno requerida' : 'GEMINI_API_KEY variable de entorno requerida'),
      billingRequired: false,
      freeTier: true,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = new GoogleAiAdapter();
