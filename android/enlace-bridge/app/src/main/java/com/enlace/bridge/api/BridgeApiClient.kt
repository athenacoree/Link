package com.enlace.bridge.api

import com.enlace.bridge.auth.DeviceIdentityManager
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class BridgeApiClient(private val identityManager: DeviceIdentityManager) {

    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun claimPairing(pairingCode: String, deviceName: String, bridgeVersion: String, capabilities: Map<String, String>): Result<JsonObject> {
        return withContext(Dispatchers.IO) {
            try {
                val url = "${identityManager.getServerUrl()}/api/bridge/pairing/claim"
                val payload = JsonObject().apply {
                    addProperty("pairing_code", pairingCode)
                    addProperty("device_name", deviceName)
                    addProperty("bridge_version", bridgeVersion)
                    add("capabilities", gson.toJsonTree(capabilities))
                }

                val request = Request.Builder()
                    .url(url)
                    .post(payload.toString().toRequestBody(jsonMediaType))
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    val json = gson.fromJson(bodyStr, JsonObject::class.java)
                    if (response.isSuccessful && json.has("ok") && json.get("ok").asBoolean) {
                        Result.success(json)
                    } else {
                        val err = if (json.has("error")) json.get("error").asString else "Error ${response.code}"
                        Result.failure(Exception(err))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    suspend fun sendHeartbeat(bridgeVersion: String, capabilities: Map<String, String>, permissions: Map<String, Boolean>): Result<Boolean> {
        return withContext(Dispatchers.IO) {
            val deviceId = identityManager.getDeviceId() ?: return@withContext Result.failure(Exception("Sin dispositivo"))
            val token = identityManager.getDeviceToken() ?: return@withContext Result.failure(Exception("Sin token"))

            try {
                val url = "${identityManager.getServerUrl()}/api/bridge/device/heartbeat"
                val payload = JsonObject().apply {
                    addProperty("bridge_version", bridgeVersion)
                    add("capabilities", gson.toJsonTree(capabilities))
                    add("permissions", gson.toJsonTree(permissions))
                }

                val request = Request.Builder()
                    .url(url)
                    .header("X-Bridge-Device-ID", deviceId)
                    .header("X-Bridge-Token", token)
                    .post(payload.toString().toRequestBody(jsonMediaType))
                    .build()

                client.newCall(request).execute().use { response ->
                    Result.success(response.isSuccessful)
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    suspend fun fetchPendingActions(): Result<List<JsonObject>> {
        return withContext(Dispatchers.IO) {
            val deviceId = identityManager.getDeviceId() ?: return@withContext Result.failure(Exception("Sin dispositivo"))
            val token = identityManager.getDeviceToken() ?: return@withContext Result.failure(Exception("Sin token"))

            try {
                val url = "${identityManager.getServerUrl()}/api/bridge/actions/pending"
                val request = Request.Builder()
                    .url(url)
                    .header("X-Bridge-Device-ID", deviceId)
                    .header("X-Bridge-Token", token)
                    .get()
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    val json = gson.fromJson(bodyStr, JsonObject::class.java)
                    if (response.isSuccessful && json.has("ok") && json.get("ok").asBoolean) {
                        val actionsArr = json.getAsJsonArray("pending_actions")
                        val list = actionsArr.map { it.asJsonObject }
                        Result.success(list)
                    } else {
                        Result.failure(Exception("Error consultando acciones"))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    suspend fun verifyAction(actionId: String): Result<JsonObject> {
        return withContext(Dispatchers.IO) {
            val deviceId = identityManager.getDeviceId() ?: return@withContext Result.failure(Exception("Sin dispositivo"))
            val token = identityManager.getDeviceToken() ?: return@withContext Result.failure(Exception("Sin token"))

            try {
                val url = "${identityManager.getServerUrl()}/api/bridge/actions/$actionId/verify"
                val request = Request.Builder()
                    .url(url)
                    .header("X-Bridge-Device-ID", deviceId)
                    .header("X-Bridge-Token", token)
                    .post("{}".toRequestBody(jsonMediaType))
                    .build()

                client.newCall(request).execute().use { response ->
                    val bodyStr = response.body?.string() ?: ""
                    val json = gson.fromJson(bodyStr, JsonObject::class.java)
                    if (response.isSuccessful && json.has("valid") && json.get("valid").asBoolean) {
                        Result.success(json.getAsJsonObject("action"))
                    } else {
                        val reason = if (json.has("reason")) json.get("reason").asString else "Acción inválida"
                        Result.failure(Exception(reason))
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    suspend fun completeAction(actionId: String, status: String, resultPayload: Map<String, Any> = emptyMap()): Result<Boolean> {
        return withContext(Dispatchers.IO) {
            val deviceId = identityManager.getDeviceId() ?: return@withContext Result.failure(Exception("Sin dispositivo"))
            val token = identityManager.getDeviceToken() ?: return@withContext Result.failure(Exception("Sin token"))

            try {
                val url = "${identityManager.getServerUrl()}/api/bridge/actions/$actionId/complete"
                val payload = JsonObject().apply {
                    addProperty("status_result", status)
                    add("result_payload", gson.toJsonTree(resultPayload))
                }

                val request = Request.Builder()
                    .url(url)
                    .header("X-Bridge-Device-ID", deviceId)
                    .header("X-Bridge-Token", token)
                    .post(payload.toString().toRequestBody(jsonMediaType))
                    .build()

                client.newCall(request).execute().use { response ->
                    Result.success(response.isSuccessful)
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
}
