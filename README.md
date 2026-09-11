# Enlace — red social real (PWA + backend + llamadas WebRTC)

[![Desplegar en Render](https://render.com/images/deploy-to-render.svg)](https://render.com/deploy)

Esto ya no es una maqueta: es una aplicación completa y funcional.

- **Backend real**: Node.js + Express + Socket.io.
- **Base de datos de Render**: PostgreSQL, se crea y migra **sola** al arrancar
  (perfiles, publicaciones, amistades, estados, notificaciones, llamadas).
  Usa columnas **JSONB** para datos flexibles (`notifications.data`,
  `calls.metadata`, `users.extra`).
- **MongoDB Atlas**: guarda los **mensajes de chat** (colección `messages`),
  separado a propósito de la base "estructural" de Render.
- **Migraciones no destructivas**: cada cambio de esquema es aditivo
  (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). El runner
  (`backend/db/migrate.js`) directamente **rechaza** cualquier migración
  que contenga `DROP TABLE`, `DROP COLUMN` o `TRUNCATE`.
- **Llamadas de audio/video reales**: WebRTC punto a punto, señalizado por
  Socket.io. La interfaz es la que me pasaste (mismo diseño y misma lógica),
  sin barra de navegación ni pantallas de configuración: solo lo que se ve
  mientras entra, se contesta y transcurre una llamada.
- **PWA instalable**: `manifest.json` + `service worker` con caché del shell
  de la app (los datos del API nunca se cachean, siempre son reales/frescos).
- **Estructura de contenido tipo "encontrar personas"**: la pantalla
  principal ("Inicio") muestra **personas para descubrir**, no un muro
  mezclado de publicaciones. Las publicaciones de alguien (texto, foto,
  likes, comentarios) solo se ven **al entrar a su perfil** — nadie ve el
  contenido de una persona sin visitar su perfil primero. Tú publicas desde
  tu propio perfil (hay un acceso directo "Ver mi perfil" en Ajustes, o
  tocando tu nombre/avatar), y ahí mismo se ve todo lo que has publicado.
- **Imágenes**: avatares, portadas, fotos de publicaciones y estados se
  guardan en base64 dentro de Postgres (no hay disco persistente en el plan
  gratis de Render, así que esto evita que las fotos se pierdan al reiniciar
  el servicio).

---

## 1. Estructura del proyecto

```
enlace/
├── render.yaml              ← Blueprint de despliegue en Render
├── backend/
│   ├── server.js            ← Punto de entrada (Express + Socket.io)
│   ├── db/
│   │   ├── postgres.js      ← Pool de conexión
│   │   ├── migrate.js       ← Runner de migraciones no destructivas
│   │   ├── mongo.js         ← Conexión a MongoDB Atlas
│   │   └── migrations/      ← Archivos .sql numerados (001_, 002_...)
│   ├── models/Message.js    ← Modelo Mongoose (mensajes en Atlas)
│   ├── routes/               ← auth, usuarios, amigos, publicaciones, estados...
│   ├── sockets/index.js      ← Mensajería en tiempo real + señalización WebRTC
│   └── jobs/cleanupStories.js← Borra estados vencidos (24h) cada 15 min
└── frontend/                 ← PWA servida como archivos estáticos por Express
    ├── index.html
    ├── css/ (app.css, call.css)
    ├── js/ (api.js, app.js, chat.js, call.js)
    ├── manifest.json, sw.js, icons/
```

---

## 2. Desplegar en Render (plan gratuito)

### Opción A — Blueprint automático (recomendado)

1. Sube esta carpeta a un repositorio de GitHub (o GitLab).
2. Entra a [render.com](https://render.com) → **New** → **Blueprint**.
3. Conecta el repositorio. Render leerá `render.yaml` y creará solo:
   - Un **Web Service** gratuito (`enlace`) apuntando a `backend/`.
   - Una **base de datos PostgreSQL** gratuita (`enlace-db`), ya conectada
     automáticamente al servicio mediante la variable `DATABASE_URL`.
4. Render te pedirá el valor de `MONGODB_URI` (ver paso 3 abajo) porque esa
   variable está marcada como `sync: false` — no se genera sola, la pegas tú.
5. Dale a **Apply**. Cuando termine el build, el servicio:
   - Corre `npm install`.
   - Al arrancar (`npm start` → `server.js`) aplica las migraciones de
     Postgres automáticamente (crea todas las tablas si no existen).
   - Se conecta a MongoDB Atlas.
   - Sirve la PWA y el API en la misma URL que te da Render.

### Opción B — Manual (sin Blueprint)

1. New → PostgreSQL → plan Free → crea `enlace-db`. Copia su
   "Internal Database URL".
2. New → Web Service → conecta el repo → Root Directory: `backend` →
   Build Command: `npm install` → Start Command: `npm start`.
3. En "Environment", agrega las variables de `.env.example`
   (`DATABASE_URL` con la URL del paso 1, `MONGODB_URI`, `JWT_SECRET`, etc).
4. Deploy.

> El plan gratuito de Render "duerme" el servicio tras ~15 min sin tráfico y
> tarda unos segundos en despertar con la siguiente visita — es una
> limitación del plan gratuito, no de la app.

---

## 3. Crear el cluster gratuito de MongoDB Atlas (mensajes de chat)

1. Entra a [cloud.mongodb.com](https://cloud.mongodb.com) y crea una cuenta.
2. **Build a Database** → elige el plan **M0 (gratis)** → elige una región
   cercana → créalo.
3. **Database Access** → Add New Database User → usuario/contraseña
   (guárdalos).
4. **Network Access** → Add IP Address → **Allow access from anywhere**
   (`0.0.0.0/0`) — necesario porque Render usa IPs dinámicas en el plan free.
5. **Connect** → "Drivers" → copia la cadena de conexión, se ve así:
   ```
   mongodb+srv://usuario:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Agrégale el nombre de la base al final, antes de los parámetros:
   ```
   mongodb+srv://usuario:password@cluster0.xxxxx.mongodb.net/enlace?retryWrites=true&w=majority
   ```
7. Pega esa URL completa como `MONGODB_URI` en las variables de entorno de
   Render.

---

## 4. Variables de entorno

Copia `backend/.env.example` como guía. Las importantes:

| Variable | Quién la pone | Descripción |
|---|---|---|
| `DATABASE_URL` | Render (automática con el Blueprint) | Postgres |
| `MONGODB_URI` | Tú (Atlas) | Mensajes de chat |
| `JWT_SECRET` | Render (`generateValue: true`) o tú | Firma de sesiones |
| `CORS_ORIGIN` | Tú | `*` si sirves todo desde el mismo dominio |
| `STORY_CLEANUP_INTERVAL_MIN` | Opcional | Cada cuánto se borran estados vencidos |

---

## 5. Correr en tu computadora (local)

```bash
cd backend
cp .env.example .env      # y edítalo con tus datos reales
npm install
npm run migrate           # crea las tablas en tu Postgres local o remoto
npm start                 # http://localhost:10000
```

El frontend se sirve automáticamente desde el mismo servidor Express
(`frontend/` como estáticos), así que no necesitas otro proceso aparte.

---

## 6. Cómo funcionan las llamadas (audio/video)

- Es **WebRTC real**: el audio/video viaja directo entre los dos
  navegadores (peer-to-peer), el servidor solo transporta la
  "señalización" (quién llama, la oferta/respuesta SDP, y los candidatos
  ICE) por Socket.io.
- Usa servidores **STUN** públicos de Google para resolver NAT — suficiente
  para la mayoría de las redes caseras y móviles.
- **Para redes muy restrictivas** (NAT simétrico, algunas redes
  corporativas/4G), WebRTC a veces necesita un servidor **TURN** además del
  STUN. Si en el futuro ves llamadas que se quedan en "Conectando…" en
  ciertas redes, agrega un TURN gratuito/pago (ej. Twilio, Metered.ca,
  Cloudflare Calls) y súmalo al arreglo `ICE_SERVERS` en
  `frontend/js/call.js`.
- La interfaz (pantalla de llamada entrante, controles, burbuja
  minimizada, chat dentro de la llamada) es la misma que me compartiste,
  sin la barra de navegación ni las pantallas de configuración de aquel
  prototipo — aquí se activa sola cuando entra o se hace una llamada real
  dentro de la red social.

---

## 7. Qué vive en cada base de datos (y por qué)

- **PostgreSQL (Render)**: perfiles de usuario, imágenes en base64
  (avatar/portada/publicaciones/estados), amistades, notificaciones
  (`JSONB`), registro de llamadas (`JSONB`), y los estados de 24h — estos
  últimos se **autodestruyen** con un job periódico (`jobs/cleanupStories.js`)
  que borra únicamente las **filas** vencidas, nunca el esquema.
- **MongoDB Atlas**: los mensajes de chat (colección `messages`), separados
  a propósito para que la mensajería escale independiente de la base
  estructural.

## 8. Migraciones no destructivas: cómo agregar una nueva

1. Crea un archivo nuevo en `backend/db/migrations/`, numerado después del
   último (ej. `003_algo_nuevo.sql`).
2. Escribe solo sentencias aditivas:
   `CREATE TABLE IF NOT EXISTS ...`, `ALTER TABLE ... ADD COLUMN IF NOT
   EXISTS ...`, `CREATE INDEX IF NOT EXISTS ...`.
3. Al desplegar, `server.js` corre `runMigrations()` automáticamente y
   aplica solo los archivos nuevos (guarda un registro en
   `schema_migrations` para no repetirlos). Si el archivo intenta un
   `DROP` o `TRUNCATE`, el arranque falla a propósito para protegerte.

---

## 9. Limitaciones honestas del plan gratuito

- Postgres free de Render tiene límite de almacenamiento (ideal para
  texto + imágenes livianas en base64, no para video ni archivos grandes).
- El servicio web gratis "duerme" sin tráfico y tarda unos segundos en
  despertar.
- MongoDB Atlas M0 tiene 512 MB — de sobra para empezar con mensajería.
- WebRTC sin TURN puede fallar en redes muy restrictivas (ver sección 6).

Con esto, la app que tenías en dos archivos HTML sueltos ahora es un
servicio real: cuentas de verdad, gente real que puedes encontrar y
agregar, mensajes que persisten, y llamadas que funcionan de navegador a
navegador.
