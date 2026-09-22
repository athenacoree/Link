package com.enlace.bridge.calls

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.enlace.bridge.auth.DeviceIdentityManager
import com.enlace.bridge.router.UniversalRouter

class CallActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val callManager = CallBridgeManager(context)
        callManager.cancelCallNotification()

        val action = intent.action
        val targetRoute = intent.getStringExtra("target_route") ?: "/app/home"

        if (action == CallBridgeManager.ACTION_ANSWER_CALL) {
            val identityManager = DeviceIdentityManager(context)
            val router = UniversalRouter(context, identityManager)
            router.openUniversalRoute(targetRoute)
        }
    }
}
