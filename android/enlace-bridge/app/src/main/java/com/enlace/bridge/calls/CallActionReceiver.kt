package com.enlace.bridge.calls

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.enlace.bridge.MainActivity
import com.enlace.bridge.auth.DeviceIdentityManager

class CallActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val callManager = CallBridgeManager(context)
        callManager.cancelCallNotification()

        val action = intent.action
        val targetRoute = intent.getStringExtra("target_route") ?: "/"

        if (action == CallBridgeManager.ACTION_ANSWER_CALL) {
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("target_route", targetRoute)
            }
            context.startActivity(launchIntent)
        }
    }
}
