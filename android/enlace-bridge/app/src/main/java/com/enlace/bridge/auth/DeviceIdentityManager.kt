package com.enlace.bridge.auth

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID

class DeviceIdentityManager(private val context: Context) {

    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences("enlace_bridge_prefs", Context.MODE_PRIVATE)
    }

    fun getDeviceId(): String? = prefs.getString(KEY_DEVICE_ID, null)

    fun getDeviceToken(): String? = prefs.getString(KEY_DEVICE_TOKEN, null)

    fun getUserId(): String? = prefs.getString(KEY_USER_ID, null)

    fun getServerUrl(): String = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL

    fun isPaired(): Boolean = !getDeviceId().isNullOrEmpty() && !getDeviceToken().isNullOrEmpty()

    fun savePairing(deviceId: String, deviceToken: String, userId: String) {
        prefs.edit()
            .putString(KEY_DEVICE_ID, deviceId)
            .putString(KEY_DEVICE_TOKEN, deviceToken)
            .putString(KEY_USER_ID, userId)
            .apply()
    }

    fun setServerUrl(url: String) {
        prefs.edit().putString(KEY_SERVER_URL, url.trimEnd('/')).apply()
    }

    fun clearPairing() {
        prefs.edit()
            .remove(KEY_DEVICE_ID)
            .remove(KEY_DEVICE_TOKEN)
            .remove(KEY_USER_ID)
            .apply()
    }

    fun getHardwareIdentityHash(): String {
        var hardwareId = prefs.getString(KEY_HARDWARE_HASH, null)
        if (hardwareId == null) {
            hardwareId = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_HARDWARE_HASH, hardwareId).apply()
        }
        return hardwareId
    }

    companion object {
        private const val KEY_DEVICE_ID = "bridge_device_id"
        private const val KEY_DEVICE_TOKEN = "bridge_device_token"
        private const val KEY_USER_ID = "bridge_user_id"
        private const val KEY_SERVER_URL = "bridge_server_url"
        private const val KEY_HARDWARE_HASH = "bridge_hardware_hash"
        const val DEFAULT_SERVER_URL = "https://enlace.com"
    }
}
