package com.enlace.bridge.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.enlace.bridge.actions.NativeActionManager
import com.enlace.bridge.api.BridgeApiClient
import com.enlace.bridge.auth.DeviceIdentityManager
import com.enlace.bridge.calls.CallBridgeManager
import com.enlace.bridge.router.UniversalRouter

class BridgeSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        private const val TAG = "BridgeSyncWorker"
        const val WORK_NAME = "EnlaceBridgeSyncWork"
    }

    override suspend fun doWork(): Result {
        val identityManager = DeviceIdentityManager(applicationContext)
        if (!identityManager.isPaired()) {
            Log.d(TAG, "Dispositivo no vinculado, omitiendo sincronización")
            return Result.success()
        }

        val apiClient = BridgeApiClient(identityManager)
        val router = UniversalRouter(applicationContext, identityManager)
        val callManager = CallBridgeManager(applicationContext)
        val actionManager = NativeActionManager(applicationContext, apiClient, router, callManager)

        return try {
            val processed = actionManager.syncPendingActions()
            Log.d(TAG, "Sincronización completada. Acciones procesadas: $processed")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Error durante sincronización en segundo plano", e)
            Result.retry()
        }
    }
}
