package com.enlace.bridge.router

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.browser.customtabs.CustomTabsIntent
import com.enlace.bridge.auth.DeviceIdentityManager

class UniversalRouter(private val context: Context, private val identityManager: DeviceIdentityManager) {

    companion object {
        private const val TAG = "UniversalRouter"
        private val ALLOWED_COMMANDS = setOf(
            "home", "feed", "profile", "perfil", "chat", "notifications",
            "notificaciones", "call", "payment", "pago", "security",
            "settings", "configuraciones", "verification", "verificacion",
            "market", "ads", "username"
        )
    }

    /**
     * Build and validate safe full URL for the route.
     * Returns null if route is invalid or untrusted.
     */
    fun getValidatedUrl(route: String): String? {
        val serverUrl = identityManager.getServerUrl().trimEnd('/')
        val serverUri = try { Uri.parse(serverUrl) } catch (e: Exception) { return null }
        val officialHost = serverUri.host ?: return null

        val targetUri = if (route.startsWith("http://") || route.startsWith("https://")) {
            try { Uri.parse(route) } catch (e: Exception) { return null }
        } else {
            val cleanPath = if (route.startsWith("/")) route else "/$route"
            try { Uri.parse("$serverUrl$cleanPath") } catch (e: Exception) { return null }
        }

        // 1. Validate host matches configured server
        val targetHost = targetUri.host
        if (targetHost == null || !targetHost.equals(officialHost, ignoreCase = true)) {
            Log.w(TAG, "Rechazada URL no oficial: host '$targetHost' != '$officialHost'")
            return null
        }

        // 2. Validate scheme
        val scheme = targetUri.scheme
        if (scheme != "https" && scheme != "http") {
            Log.w(TAG, "Esquema inválido: $scheme")
            return null
        }

        // 3. Validate path prefix is /app/ or / (dynamic web app routes)
        val path = targetUri.path ?: ""
        if (!path.startsWith("/app/") && path != "/app" && path != "/") {
            Log.w(TAG, "Ruta no pertenece a /app/: $path")
            return null
        }

        return targetUri.toString()
    }

    fun openUniversalRoute(route: String): Boolean {
        val safeUrl = getValidatedUrl(route)
        if (safeUrl == null) {
            Log.e(TAG, "Intento de abrir ruta no segura o no autorizada: $route")
            return false
        }

        try {
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()

            customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            customTabsIntent.launchUrl(context, Uri.parse(safeUrl))
            return true
        } catch (e: Exception) {
            return try {
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(safeUrl)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(browserIntent)
                true
            } catch (ex: Exception) {
                Log.e(TAG, "Error abriendo navegador para $safeUrl", ex)
                false
            }
        }
    }
}
