/* Lógica compatible para compatibilidad con código existente */
window.AILab = {
  init() {
    if (window.LinkVideo) window.LinkVideo.init();
  },
  cargarEventoActivo() {},
  entrarExperienciaActiva() {},
  salirExperiencia() {},
  volverALabAI() {},
  openComposer() {},
  closeComposer() {},
  scrollToBottom() {},
  cancelGeneration() {}
};
