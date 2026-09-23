# LINK GOOGLE SERVICES ENGINE

Architectural, operational, and security documentation for the **Link Google Services Engine**.

---

## 1. Overview

The **Link Google Services Engine** is an idempotent, free-first, modular configuration and runtime engine for Google Cloud and Firebase services integrated into Link.

It acts as an automatic setup wizard on deployment (e.g. Render deployments) that auto-detects, validates, registers, and exposes available Google Cloud & Firebase capabilities without risking unexpected costs, breaking existing database/AI workflows, or leaking security credentials.

---

## 2. Core Architecture

The engine is located under `backend/google-services/` and structured into isolated modules:

```text
backend/google-services/
├── config/
│   ├── firebaseConfig.js       # Firebase project & client/admin credentials configuration
│   └── googleCloudConfig.js    # Google Cloud project & billing state detection
├── registry/
│   └── serviceRegistry.js      # Central registry tracking service statuses and capabilities
├── security/
│   └── securityGuard.js        # Secret masking and credentials sanitization
├── engine/
│   ├── stateManager.js         # Persistence in PostgreSQL (google_services_state table)
│   └── bootstrapEngine.js      # Main idempotent orchestrator & migration manager
├── adapters/
│   ├── firebaseAuthAdapter.js          # Authentication & Google Sign-In
│   ├── firebaseAppCheckAdapter.js     # App Check safety logic
│   ├── firebaseFcmAdapter.js          # Cloud Messaging (push notifications)
│   ├── firebaseAnalyticsAdapter.js    # Analytics, Performance, Remote Config
│   ├── googleAiAdapter.js             # Gemini & Firebase AI Logic (preserves GEMINI_API_KEY)
│   ├── googleMapsAdapter.js           # Maps, Places, Geocoding, Routes, Street View
│   ├── googleVisionAdapter.js         # Vision / OCR APIs
│   ├── googleTranslationAdapter.js    # Translation APIs
│   ├── googleSpeechAdapter.js         # Speech-to-Text & Text-to-Speech
│   └── googleEnvironmentalAdapter.js  # Weather, Air Quality, Pollen, Solar APIs
└── index.js                           # Unified exports
```

---

## 3. Database Principle

- **Primary Database:** Link's primary database remains PostgreSQL.
- **No Firestore Migration:** Firebase and Google Cloud services do NOT replace or migrate PostgreSQL data.
- **Engine State Storage:** Bootstrap completion state and service metadata are stored in PostgreSQL table `google_services_state` (or fallback memory if PostgreSQL is temporarily unreachable during bootstrapping).

---

## 4. Free-First Cost Rules & Status Matrix

To avoid unbudgeted cloud charges, the engine enforces strict **free-first principles**:

1. Services requiring pay-as-you-go billing (Blaze plan / billed APIs without free tier safety) are flagged as `BILLING_REQUIRED` and are **NEVER** auto-enabled.
2. Services with generous free monthly quotas (e.g., Firebase Auth standard limits, standard Gemini free tier) are assigned `FREE` or `FREE_QUOTA`.
3. Status categories evaluated by adapters:
   - `FREE`: Available within free limits without requiring paid billing.
   - `FREE_QUOTA`: Free tier quota available.
   - `DEMO_ONLY`: Simulated / restricted preview mode active.
   - `BILLING_REQUIRED`: Requires Google Cloud Billing / Blaze account.
   - `NOT_AVAILABLE`: Missing prerequisites or disabled at GCP level.
   - `CONFIG_REQUIRED`: Needs missing environment variables or IAM permission.
   - `ENABLED` / `CONNECTED`: Operational and validated.
   - `ERROR`: Misconfigured or API request error.

---

## 5. Security & Secret Handling

- **No Secrets in Repo:** `service-account.json` or private key files must NEVER be committed to Git.
- **Public vs Administrative Keys:** Frontend components only use public Firebase web parameters (`apiKey`, `authDomain`, `projectId`, `appId`).
- **Secret Sanitization:** All diagnostic outputs and state logs pass through `securityGuard.sanitizeObject()` which automatically redacts values for keys like `apiKey`, `privateKey`, `password`, `secret`, `bearer`, or `token`.

---

## 6. Environment Variables Reference

| Variable Name | Required / Optional | Description | Default |
| --- | --- | --- | --- |
| `GOOGLE_SERVICES_BOOTSTRAP_DONE` | Optional | Set to `true` by engine after initial bootstrap | `false` |
| `GOOGLE_SERVICES_BOOTSTRAP_VERSION` | Optional | Version integer of the bootstrap logic | `1` |
| `GOOGLE_MAPS_ENABLED` | Optional | Feature flag enabling interactive Google Maps | `false` |
| `FIREBASE_PROJECT_ID` | Optional | Firebase Project ID | `linkai-3eda1` |
| `FIREBASE_AUTH_DOMAIN` | Optional | Firebase Auth Domain | `linkai-3eda1.firebaseapp.com` |
| `FIREBASE_STORAGE_BUCKET` | Optional | Firebase Storage Bucket | `linkai-3eda1.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | Optional | Firebase Messaging Sender ID | `3670012873` |
| `FIREBASE_APP_ID` | Optional | Firebase Web App ID | `1:3670012873:web:f45dbc96a48b1c40a62e18` |
| `FIREBASE_MEASUREMENT_ID` | Optional | Firebase Measurement ID | `G-7T38731QBT` |
| `FIREBASE_CLIENT_EMAIL` | Optional | Service Account Email for Admin SDK | - |
| `FIREBASE_PRIVATE_KEY` | Optional | Service Account Private Key for Admin SDK | - |
| `GOOGLE_CLOUD_PROJECT` | Optional | GCP Project ID | `linkai-3eda1` |
| `GOOGLE_CLOUD_BILLING_ENABLED` | Optional | Set `true` if GCP billing is explicitly enabled | `false` |
| `GOOGLE_MAPS_API_KEY` | Optional | Google Maps Platform API Key | - |
| `GEMINI_API_KEY` | Optional | Google Gemini / AI Key (Preserved existing key) | - |

---

## 7. Operational Commands & Re-running Migrations

### Triggering Manual Bootstrap Checks
From the Link Admin Panel -> **Google Services** tab -> click **⚡ Configurar servicios Google**.
Alternatively, trigger via administrative POST call:
```bash
POST /api/admin/google-services/configure
```

### Re-running Bootstrap Engine
To force a re-run or upgrade bootstrap logic:
1. Increment `BOOTSTRAP_VERSION` in `backend/google-services/engine/bootstrapEngine.js` or set `force: true` when calling `runGoogleServicesBootstrap({ force: true })`.
2. Or set `GOOGLE_SERVICES_BOOTSTRAP_DONE=false` in environment variables.

---

## 8. Summary Output Example

When Render or server starts up, the engine outputs the deployment summary:

```text
LINK GOOGLE SERVICES
--------------------
Firebase: CONNECTED
Google Cloud: DETECTED
Gemini: CONFIGURED
Maps: CONFIG REQUIRED
Places: CONFIG REQUIRED
Vision: NOT CONFIGURED
Translation: NOT CONFIGURED

Bootstrap: COMPLETED
Version: 1
```
