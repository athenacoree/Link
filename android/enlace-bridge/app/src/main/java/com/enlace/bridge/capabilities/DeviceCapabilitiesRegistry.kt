package com.enlace.bridge.capabilities

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

class DeviceCapabilitiesRegistry(private val context: Context) {

    fun getCapabilitiesMap(): Map<String, String> {
        return mapOf(
            "notifications" to checkCapability("notifications"),
            "calls" to checkCapability("calls"),
            "camera" to checkCapability("camera"),
            "microphone" to checkCapability("microphone"),
            "location" to checkCapability("location"),
            "bluetooth" to checkCapability("bluetooth"),
            "files" to "available",
            "share" to "available",
            "qr" to checkCapability("camera"),
            "biometric" to checkCapability("biometric"),
            "shortcuts" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) "available" else "unsupported",
            "widgets" to "available",
            "assistant" to "available"
        )
    }

    fun getPermissionsMap(): Map<String, Boolean> {
        return mapOf(
            "POST_NOTIFICATIONS" to (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) isGranted(Manifest.permission.POST_NOTIFICATIONS) else true),
            "RECORD_AUDIO" to isGranted(Manifest.permission.RECORD_AUDIO),
            "CAMERA" to isGranted(Manifest.permission.CAMERA),
            "ACCESS_FINE_LOCATION" to isGranted(Manifest.permission.ACCESS_FINE_LOCATION)
        )
    }

    private fun checkCapability(cap: String): String {
        return when (cap) {
            "notifications" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (isGranted(Manifest.permission.POST_NOTIFICATIONS)) "available" else "permission_required"
                } else "available"
            }
            "calls" -> {
                if (isGranted(Manifest.permission.RECORD_AUDIO)) "available" else "permission_required"
            }
            "camera" -> {
                if (context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
                    if (isGranted(Manifest.permission.CAMERA)) "available" else "permission_required"
                } else "unsupported"
            }
            "microphone" -> {
                if (context.packageManager.hasSystemFeature(PackageManager.FEATURE_MICROPHONE)) {
                    if (isGranted(Manifest.permission.RECORD_AUDIO)) "available" else "permission_required"
                } else "unsupported"
            }
            "location" -> {
                if (isGranted(Manifest.permission.ACCESS_FINE_LOCATION)) "available" else "permission_required"
            }
            "bluetooth" -> {
                if (context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH)) "available" else "unsupported"
            }
            "biometric" -> {
                if (context.packageManager.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)) "available" else "unsupported"
            }
            else -> "available"
        }
    }

    private fun isGranted(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }
}
