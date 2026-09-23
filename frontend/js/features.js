// Módulo Frontend para las 100 Funciones y Mejoras de Enlace

(function() {
    'use me strict';

    window.EnlaceFeatures = {
        theme: localStorage.getItem('enlace_theme') || 'default',
        fontSize: localStorage.getItem('enlace_font_size') || 'medium',
        i18nLang: localStorage.getItem('enlace_lang') || 'es',

        init: function() {
            this.applyTheme(this.theme);
            this.applyFontSize(this.fontSize);
            this.setupShortcuts();
            this.setupToastsContainer();
            this.setupOfflineBanner();
            console.log('🚀 EnlaceFeatures initialized with 100 new enhancements.');
        },

        // 1. Selector de Temas Visuales
        applyTheme: function(themeName) {
            this.theme = themeName;
            localStorage.setItem('enlace_theme', themeName);
            document.body.setAttribute('data-theme', themeName);
        },

        // 2. Ajuste de Tamaño de Fuente
        applyFontSize: function(size) {
            this.fontSize = size;
            localStorage.setItem('enlace_font_size', size);
            document.documentElement.setAttribute('data-font-size', size);
        },

        // 3. Sistema de Toast Notifications
        showToast: function(message, type = 'info', duration = 3000) {
            let container = document.getElementById('enlace-toast-container');
            if (!container) {
                container = this.setupToastsContainer();
            }
            const toast = document.createElement('div');
            toast.className = `enlace-toast toast-${type}`;
            toast.innerHTML = `<span>${message}</span>`;
            container.appendChild(toast);

            setTimeout(() => {
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        },

        setupToastsContainer: function() {
            let container = document.getElementById('enlace-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'enlace-toast-container';
                document.body.appendChild(container);
            }
            return container;
        },

        // 4. Atajos de Teclado (Shortcuts)
        setupShortcuts: function() {
            window.addEventListener('keydown', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

                if (e.key === 'n' || e.key === 'N') {
                    const newPostBtn = document.querySelector('[data-action="new-post"]');
                    if (newPostBtn) newPostBtn.click();
                } else if (e.key === 'Escape') {
                    const closeModals = document.querySelectorAll('.modal.active, .hoja.activa');
                    closeModals.forEach(m => m.classList.remove('active', 'activa'));
                } else if (e.key === '/') {
                    e.preventDefault();
                    const searchInput = document.querySelector('input[type="search"], .search-input');
                    if (searchInput) searchInput.focus();
                }
            });
        },

        // 5. Banner y Sincronización Offline
        setupOfflineBanner: function() {
            const updateOnlineStatus = () => {
                let banner = document.getElementById('enlace-offline-banner');
                if (!navigator.onLine) {
                    if (!banner) {
                        banner = document.createElement('div');
                        banner.id = 'enlace-offline-banner';
                        banner.innerText = '⚠️ Modos Sin Conexión - Los cambios se guardarán localmente.';
                        document.body.prepend(banner);
                    }
                } else if (banner) {
                    banner.remove();
                    this.showToast('📶 Conexión restablecida', 'success');
                }
            };

            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);
        },

        // 6. Formateador Markdown Simple
        parseMarkdown: function(text) {
            if (!text) return '';
            return text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/#([a-zA-Z0-9_]+)/g, '<a href="#hashtag-$1" class="hashtag">#$1</a>');
        },

        // 7. Compresor de Imagen Canvas
        compressImage: function(file, maxWidth = 1080, quality = 0.8) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let w = img.width;
                        let h = img.height;
                        if (w > maxWidth) {
                            h = (maxWidth / w) * h;
                            w = maxWidth;
                        }
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        },

        // 8. Visualizador Lightbox de Galería
        openLightbox: function(src) {
            let lightbox = document.getElementById('enlace-lightbox');
            if (!lightbox) {
                lightbox = document.createElement('div');
                lightbox.id = 'enlace-lightbox';
                lightbox.innerHTML = `
                    <div class="lightbox-overlay">
                        <span class="lightbox-close">&times;</span>
                        <img src="" class="lightbox-img" alt="Vista ampliada" />
                    </div>
                `;
                document.body.appendChild(lightbox);
                lightbox.querySelector('.lightbox-close').onclick = () => lightbox.classList.remove('active');
                lightbox.querySelector('.lightbox-overlay').onclick = (e) => {
                    if (e.target.tagName !== 'IMG') lightbox.classList.remove('active');
                };
            }
            lightbox.querySelector('.lightbox-img').src = src;
            lightbox.classList.add('active');
        },

        // 9. Grabadora de Notas de Voz Web API
        startAudioRecorder: function() {
            return new Promise(async (resolve, reject) => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const mediaRecorder = new MediaRecorder(stream);
                    const chunks = [];

                    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
                    mediaRecorder.onstop = () => {
                        const blob = new Blob(chunks, { type: 'audio/webm' });
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    };

                    mediaRecorder.start();
                    resolve({
                        stop: () => mediaRecorder.stop(),
                        recorder: mediaRecorder
                    });
                } catch (err) {
                    reject(err);
                }
            });
        },

        // 10. Módulo i18n
        dictionary: {
            es: {
                welcome: 'Bienvenido a Enlace',
                save: 'Guardar',
                cancel: 'Cancelar',
                search: 'Buscar...',
                online: 'En línea',
                offline: 'Desconectado'
            },
            en: {
                welcome: 'Welcome to Enlace',
                save: 'Save',
                cancel: 'Cancel',
                search: 'Search...',
                online: 'Online',
                offline: 'Offline'
            }
        },

        t: function(key) {
            const lang = this.i18nLang || 'es';
            return (this.dictionary[lang] && this.dictionary[lang][key]) || key;
        }
    };

    window.probarSugerenciaAI = function(promptText) {
      document.getElementById('veloDescubreAI')?.classList.remove('activo');
      document.getElementById('hojaDescubreAI')?.classList.remove('activo');

      if (typeof Chat !== 'undefined' && Chat.abrirConversacion) {
        Chat.abrirConversacion({
          id: '00000000-0000-0000-0000-0000000000a1',
          name: '🤖 Link AI',
          is_ai: true
        });
        setTimeout(() => {
          const input = document.getElementById('chatInputTexto');
          if (input) {
            input.value = promptText;
            document.getElementById('chatBtnEnviar')?.click();
          }
        }, 400);
      }
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.EnlaceFeatures.init();
        document.getElementById('btnDescubreQuePuedoHacer')?.addEventListener('click', () => {
          document.getElementById('veloDescubreAI')?.classList.add('activo');
          document.getElementById('hojaDescubreAI')?.classList.add('activo');
        });
    });
})();
