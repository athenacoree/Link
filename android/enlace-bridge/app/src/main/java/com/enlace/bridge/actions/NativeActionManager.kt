package com.enlace.bridge.actions

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.enlace.bridge.api.BridgeApiClient
import com.enlace.bridge.calls.CallBridgeManager
import com.enlace.bridge.router.UniversalRouter
import com.google.gson.JsonObject

class NativeActionManager(
    private val context: Context,
    private val apiClient: BridgeApiClient,
    private val router: UniversalRouter,
    private val callManager: CallBridgeManager
) {

    companion object {
        private const val TAG = "NativeActionManager"
        const val CHANNEL_ID = "enlace_bridge_actions"
        const val PREFS_PROCESSED_ACTIONS = "bridge_processed_actions"
    }

    private val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Acciones y Notificaciones Enlace",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notificaciones nativas para mensajes, pagos, seguridad y eventos de Enlace"
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun isActionAlreadyProcessed(actionId: String): Boolean {
        val prefs = context.getSharedPreferences(PREFS_PROCESSED_ACTIONS, Context.MODE_PRIVATE)
        return prefs.contains(actionId)
    }

    private fun markActionAsProcessedLocally(actionId: String) {
        val prefs = context.getSharedPreferences(PREFS_PROCESSED_ACTIONS, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(actionId, true).apply()
    }

    suspend fun processAction(action: JsonObject): Boolean {
        val actionId = action.get("id")?.asString ?: return false
        if (isActionAlreadyProcessed(actionId)) {
            return false
        }

        val verification = apiClient.verifyAction(actionId)
        if (verification.isFailure) {
            Log.w(TAG, "Acción $actionId rechazada en verificación backend")
            markActionAsProcessedLocally(actionId)
            return false
        }

        val verifiedAction = verification.getOrThrow()
        val actionType = verifiedAction.get("action_type")?.asString ?: "NOTIFICATION"
        val targetRoute = verifiedAction.get("target_route")?.asString ?: "/app/home"
        val payload = if (verifiedAction.has("payload") && !verifiedAction.get("payload").isJsonNull) {
            verifiedAction.getAsJsonObject("payload")
        } else {
            JsonObject()
        }

        val title = payload.get("title")?.asString ?: when (actionType) {
            "MESSAGE" -> "Nuevo Mensaje"
            "PAYMENT" -> "Notificación de Pago"
            "SECURITY_CONFIRMATION" -> "Confirmación de Seguridad"
            "CALL", "INCOMING_CALL" -> "Llamada Entrante"
            "NEW_CONNECTION" -> "Nueva Conexión"
            else -> "Enlace"
        }

        val text = payload.get("text")?.asString
            ?: payload.get("body")?.asString
            ?: payload.get("message")?.asString
            ?: "Tienes un nuevo evento en Enlace."

        if (actionType == "CALL" || actionType == "INCOMING_CALL") {
            val callerName = payload.get("caller_name")?.asString ?: "Usuario de Enlace"
            val callerAvatar = payload.get("caller_avatar")?.asString ?: ""
            val callId = payload.get("call_id")?.asString ?: actionId
            callManager.showIncomingCallNotification(callId, callerName, callerAvatar, targetRoute)
            markActionAsProcessedLocally(actionId)
            return true
        }

        showNativeNotification(
            actionId = actionId,
            actionType = actionType,
            title = title,
            text = text,
            targetRoute = targetRoute
        )

        markActionAsProcessedLocally(actionId)
        return true
    }

    private fun showNativeNotification(
        actionId: String,
        actionType: String,
        title: String,
        text: String,
        targetRoute: String
    ) {
        val notifId = actionId.hashCode()

        val contentIntent = Intent(context, ActionNotificationReceiver::class.java).apply {
            action = ActionNotificationReceiver.ACTION_EXECUTE_ROUTE
            putExtra(ActionNotificationReceiver.EXTRA_ACTION_ID, actionId)
            putExtra(ActionNotificationReceiver.EXTRA_TARGET_ROUTE, targetRoute)
            putExtra(ActionNotificationReceiver.EXTRA_NOTIFICATION_ID, notifId)
        }

        val pendingContentIntent = PendingIntent.getBroadcast(
            context,
            notifId,
            contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingContentIntent)

        // Action button for MESSAGE ("Responder")
        if (actionType == "MESSAGE") {
            val replyIntent = Intent(context, ActionNotificationReceiver::class.java).apply {
                action = ActionNotificationReceiver.ACTION_EXECUTE_ROUTE
                putExtra(ActionNotificationReceiver.EXTRA_ACTION_ID, actionId)
                putExtra(ActionNotificationReceiver.EXTRA_TARGET_ROUTE, targetRoute)
                putExtra(ActionNotificationReceiver.EXTRA_NOTIFICATION_ID, notifId)
            }
            val replyPendingIntent = PendingIntent.getBroadcast(
                context,
                notifId + 1,
                replyIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.addAction(android.R.drawable.ic_menu_send, "Responder", replyPendingIntent)
        } else if (actionType == "PAYMENT") {
            builder.addAction(android.R.drawable.ic_menu_view, "Ver Pago", pendingContentIntent)
        } else if (actionType == "SECURITY_CONFIRMATION") {
            builder.addAction(android.R.drawable.ic_lock_lock, "Confirmar", pendingContentIntent)
        }

        notificationManager.notify(notifId, builder.build())
    }

    suspend fun syncPendingActions(): Int {
        val result = apiClient.fetchPendingActions()
        if (result.isFailure) return 0

        val actions = result.getOrThrow()
        var processedCount = 0

        for (action in actions) {
            if (processAction(action)) {
                processedCount++
            }
        }
        return processedCount
    }
}
