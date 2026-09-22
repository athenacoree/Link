package com.enlace.bridge.push

import com.enlace.bridge.actions.NativeActionManager
import com.enlace.bridge.api.BridgeApiClient
import com.enlace.bridge.auth.DeviceIdentityManager
import com.enlace.bridge.calls.CallBridgeManager
import com.enlace.bridge.router.UniversalRouter
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class BridgePushMessagingService {

    private val gson = Gson()

    fun onNewToken(token: String, identityManager: DeviceIdentityManager, apiClient: BridgeApiClient) {
        CoroutineScope(Dispatchers.IO).launch {
            apiClient.sendHeartbeat(
                bridgeVersion = "1.0.0",
                capabilities = emptyMap(),
                permissions = emptyMap()
            )
        }
    }

    fun handleIncomingPayload(
        data: Map<String, String>,
        context: android.content.Context,
        identityManager: DeviceIdentityManager,
        apiClient: BridgeApiClient
    ) {
        val actionId = data["action_id"]
        val actionType = data["action_type"] ?: "NOTIFICATION"
        val targetRoute = data["target_route"] ?: "/app/home"

        val router = UniversalRouter(context, identityManager)
        val callManager = CallBridgeManager(context)
        val actionManager = NativeActionManager(context, apiClient, router, callManager)

        if (!actionId.isNullOrEmpty()) {
            CoroutineScope(Dispatchers.IO).launch {
                actionManager.executeActionIfValid(actionId)
            }
        } else if (actionType == "INCOMING_CALL") {
            val callerName = data["caller_name"] ?: "Usuario de Enlace"
            val callerAvatar = data["caller_avatar"] ?: ""
            val callId = data["call_id"] ?: "call_${System.currentTimeMillis()}"

            callManager.showIncomingCallNotification(callId, callerName, callerAvatar, targetRoute)
        } else {
            router.openUniversalRoute(targetRoute)
        }
    }
}
