package com.enlace.bridge.calls

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat

class CallBridgeManager(private val context: Context) {

    private val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createCallNotificationChannel()
    }

    private fun createCallNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build()

            val channel = NotificationChannel(
                CHANNEL_ID,
                "Llamadas de Enlace",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notificaciones de llamadas entrantes entre usuarios de Enlace"
                setSound(ringtoneUri, audioAttributes)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500)
            }

            notificationManager.createNotificationChannel(channel)
        }
    }

    fun showIncomingCallNotification(callId: String, callerName: String, callerAvatar: String, targetRoute: String) {
        val answerIntent = Intent(context, CallActionReceiver::class.java).apply {
            action = ACTION_ANSWER_CALL
            putExtra("call_id", callId)
            putExtra("target_route", targetRoute)
        }
        val answerPendingIntent = PendingIntent.getBroadcast(
            context,
            callId.hashCode(),
            answerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val rejectIntent = Intent(context, CallActionReceiver::class.java).apply {
            action = ACTION_REJECT_CALL
            putExtra("call_id", callId)
        }
        val rejectPendingIntent = PendingIntent.getBroadcast(
            context,
            callId.hashCode() + 1,
            rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("Llamada de Enlace")
            .setContentText("$callerName te está llamando")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(true)
            .addAction(android.R.drawable.ic_menu_call, "Aceptar", answerPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Rechazar", rejectPendingIntent)
            .setFullScreenIntent(answerPendingIntent, true)

        notificationManager.notify(NOTIFICATION_ID_CALL, builder.build())
    }

    fun cancelCallNotification() {
        notificationManager.cancel(NOTIFICATION_ID_CALL)
    }

    companion object {
        const val CHANNEL_ID = "enlace_calls_channel"
        const val NOTIFICATION_ID_CALL = 2001
        const val ACTION_ANSWER_CALL = "com.enlace.bridge.ACTION_ANSWER_CALL"
        const val ACTION_REJECT_CALL = "com.enlace.bridge.ACTION_REJECT_CALL"
    }
}
