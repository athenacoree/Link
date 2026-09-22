package com.enlace.bridge.router

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import com.enlace.bridge.auth.DeviceIdentityManager

class UniversalRouter(private val context: Context, private val identityManager: DeviceIdentityManager) {

    fun openUniversalRoute(route: String) {
        val baseUrl = identityManager.getServerUrl().trimEnd('/')
        val fullUrl = if (route.startsWith("http://") || route.startsWith("https://")) {
            route
        } else {
            val cleanPath = if (route.startsWith("/")) route else "/$route"
            "$baseUrl$cleanPath"
        }

        try {
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()

            customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            customTabsIntent.launchUrl(context, Uri.parse(fullUrl))
        } catch (e: Exception) {
            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(fullUrl)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(browserIntent)
        }
    }
}
