package com.enlace.bridge.auth

import android.content.Context
import android.os.Build
import com.enlace.bridge.api.BridgeApiClient

class PairingManager(
    private val context: Context,
    private val identityManager: DeviceIdentityManager,
    private val apiClient: BridgeApiClient
) {

    suspend fun pairWithCode(pairingCode: String, capabilities: Map<String, String>): Result<String> {
        val deviceName = "Android Bridge (${Build.MODEL})"
        val bridgeVersion = "1.0.0"

        val result = apiClient.claimPairing(pairingCode, deviceName, bridgeVersion, capabilities)
        return if (result.isSuccess) {
            val json = result.getOrThrow()
            val deviceId = json.get("device_id").asString
            val deviceToken = json.get("device_token").asString
            val userId = json.get("user_id").asString

            identityManager.savePairing(deviceId, deviceToken, userId)
            Result.success(userId)
        } else {
            Result.failure(result.exceptionOrNull() ?: Exception("Error vinculando dispositivo."))
        }
    }

    fun unpair() {
        identityManager.clearPairing()
    }
}
