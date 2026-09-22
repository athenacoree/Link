package com.enlace.bridge.actions

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.enlace.bridge.api.BridgeApiClient
import com.enlace.bridge.auth.DeviceIdentityManager
import com.enlace.bridge.router.UniversalRouter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ActionNotificationReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "ActionNotifReceiver"
        const val ACTION_EXECUTE_ROUTE = "com.enlace.bridge.ACTION_EXECUTE_ROUTE"
        const val EXTRA_ACTION_ID = "action_id"
        const val EXTRA_TARGET_ROUTE = "target_route"
        const val EXTRA_NOTIFICATION_ID = "notification_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val actionId = intent.getStringExtra(EXTRA_ACTION_ID)
        val targetRoute = intent.getStringExtra(EXTRA_TARGET_ROUTE) ?: "/app/home"
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1)

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        if (notificationId != -1) {
            notificationManager.cancel(notificationId)
        }

        val identityManager = DeviceIdentityManager(context)
        val router = UniversalRouter(context, identityManager)
        val apiClient = BridgeApiClient(identityManager)

        // Dismiss notification drawer if needed
        val closeIntent = Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS)
        try { context.sendBroadcast(closeIntent) } catch (e: Exception) { /* Suppress */ }

        CoroutineScope(Dispatchers.IO).launch {
            if (!actionId.isNullOrEmpty()) {
                try {
                    val verifyRes = apiClient.verifyAction(actionId)
                    if (verifyRes.isSuccess) {
                        apiClient.completeAction(actionId, "completed")
                    } else {
                        Log.w(TAG, "Acción $actionId ya no es válida o expiró")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error verificando/completando acción $actionId", e)
                }
            }

            // Open target web route on main thread
            CoroutineScope(Dispatchers.Main).launch {
                router.openUniversalRoute(targetRoute)
            }
        }
    }
}
