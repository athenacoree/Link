package com.enlace.bridge.actions

import android.content.Context
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

    suspend fun executeActionIfValid(actionId: String): Result<Boolean> {
        val verification = apiClient.verifyAction(actionId)
        if (verification.isFailure) {
            return Result.failure(verification.exceptionOrNull() ?: Exception("Acción no válida"))
        }

        val action = verification.getOrThrow()
        val actionType = action.get("action_type")?.asString ?: ""
        val targetRoute = action.get("target_route")?.asString ?: "/app/home"
        val payload = if (action.has("payload")) action.getAsJsonObject("payload") else JsonObject()

        return when (actionType) {
            "INCOMING_CALL" -> {
                val callerName = payload.get("caller_name")?.asString ?: "Usuario de Enlace"
                val callerAvatar = payload.get("caller_avatar")?.asString ?: ""
                val callId = payload.get("call_id")?.asString ?: actionId

                callManager.showIncomingCallNotification(callId, callerName, callerAvatar, targetRoute)
                apiClient.completeAction(actionId, "completed")
                Result.success(true)
            }

            "PAYMENT_CONFIRMATION", "SECURITY_CONFIRMATION" -> {
                router.openUniversalRoute(targetRoute)
                apiClient.completeAction(actionId, "completed")
                Result.success(true)
            }

            "NOTIFICATION" -> {
                router.openUniversalRoute(targetRoute)
                apiClient.completeAction(actionId, "completed")
                Result.success(true)
            }

            else -> {
                router.openUniversalRoute(targetRoute)
                apiClient.completeAction(actionId, "completed")
                Result.success(true)
            }
        }
    }
}
