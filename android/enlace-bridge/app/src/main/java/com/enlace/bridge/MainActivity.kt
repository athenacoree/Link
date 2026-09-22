package com.enlace.bridge

import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.enlace.bridge.actions.NativeActionManager
import com.enlace.bridge.api.BridgeApiClient
import com.enlace.bridge.auth.DeviceIdentityManager
import com.enlace.bridge.auth.PairingManager
import com.enlace.bridge.calls.CallBridgeManager
import com.enlace.bridge.capabilities.DeviceCapabilitiesRegistry
import com.enlace.bridge.router.UniversalRouter
import com.enlace.bridge.sync.BridgeSyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var identityManager: DeviceIdentityManager
    private lateinit var apiClient: BridgeApiClient
    private lateinit var pairingManager: PairingManager
    private lateinit var capabilitiesRegistry: DeviceCapabilitiesRegistry
    private lateinit var router: UniversalRouter
    private lateinit var callManager: CallBridgeManager
    private lateinit var actionManager: NativeActionManager

    private lateinit var tvStatus: TextView
    private lateinit var tvDeviceDetails: TextView
    private lateinit var tvCapabilities: TextView
    private lateinit var etServerUrl: EditText
    private lateinit var etPairingCode: EditText
    private lateinit var btnPair: Button
    private lateinit var btnUnlink: Button
    private lateinit var btnSyncNow: Button
    private lateinit var btnOpenEnlace: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        identityManager = DeviceIdentityManager(this)
        apiClient = BridgeApiClient(identityManager)
        pairingManager = PairingManager(this, identityManager, apiClient)
        capabilitiesRegistry = DeviceCapabilitiesRegistry(this)
        router = UniversalRouter(this, identityManager)
        callManager = CallBridgeManager(this)
        actionManager = NativeActionManager(this, apiClient, router, callManager)

        // Handle Universal / Deep Links when opened via intent
        intent?.data?.let { uri ->
            val route = uri.path ?: "/app/home"
            router.openUniversalRoute(route)
        }

        setupUI()
        requestInitialPermissions()
        scheduleBackgroundSync()
        refreshUIState()
    }

    override fun onResume() {
        super.onResume()
        refreshUIState()
        syncPendingActionsInBg()
    }

    private fun setupUI() {
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(40, 40, 40, 40)
            setBackgroundColor(android.graphics.Color.parseColor("#F5F3FF"))
        }

        val title = TextView(this).apply {
            text = "⚡ Enlace Bridge"
            textSize = 24f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(android.graphics.Color.parseColor("#5B21B6"))
            setPadding(0, 0, 0, 20)
        }
        layout.addView(title)

        tvStatus = TextView(this).apply {
            textSize = 15f
            setPadding(0, 0, 0, 10)
        }
        layout.addView(tvStatus)

        tvDeviceDetails = TextView(this).apply {
            textSize = 12f
            setTextColor(android.graphics.Color.GRAY)
            setPadding(0, 0, 0, 20)
        }
        layout.addView(tvDeviceDetails)

        etServerUrl = EditText(this).apply {
            hint = "URL del Servidor Enlace"
            setText(identityManager.getServerUrl())
            textSize = 14f
        }
        layout.addView(etServerUrl)

        etPairingCode = EditText(this).apply {
            hint = "Código de vinculación (6 caracteres)"
            textSize = 16f
            setPadding(0, 20, 0, 20)
        }
        layout.addView(etPairingCode)

        btnPair = Button(this).apply {
            text = getString(R.string.btn_pair)
            setBackgroundColor(android.graphics.Color.parseColor("#5B21B6"))
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener { performPairing() }
        }
        layout.addView(btnPair)

        btnSyncNow = Button(this).apply {
            text = "🔄 Sincronizar Acciones Pendientes"
            setBackgroundColor(android.graphics.Color.parseColor("#059669"))
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener {
                syncPendingActionsInBg(showToast = true)
            }
        }
        layout.addView(btnSyncNow)

        btnOpenEnlace = Button(this).apply {
            text = "🌐 Abrir Enlace Web (/app/home)"
            setBackgroundColor(android.graphics.Color.parseColor("#2563EB"))
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener {
                router.openUniversalRoute("/app/home")
            }
        }
        layout.addView(btnOpenEnlace)

        btnUnlink = Button(this).apply {
            text = getString(R.string.btn_unlink)
            setBackgroundColor(android.graphics.Color.parseColor("#DC2626"))
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener {
                pairingManager.unpair()
                Toast.makeText(this@MainActivity, "Dispositivo desvinculado", Toast.LENGTH_SHORT).show()
                refreshUIState()
            }
        }
        layout.addView(btnUnlink)

        tvCapabilities = TextView(this).apply {
            textSize = 12f
            setPadding(0, 30, 0, 0)
        }
        layout.addView(tvCapabilities)

        setContentView(layout)
    }

    private fun performPairing() {
        val code = etPairingCode.text.toString().trim()
        val serverUrl = etServerUrl.text.toString().trim()

        if (code.isEmpty()) {
            Toast.makeText(this, "Ingresa un código de vinculación generado en Enlace Web", Toast.LENGTH_SHORT).show()
            return
        }

        if (serverUrl.isNotEmpty()) {
            identityManager.setServerUrl(serverUrl)
        }

        CoroutineScope(Dispatchers.Main).launch {
            btnPair.isEnabled = false
            btnPair.text = "Vinculando..."

            val caps = capabilitiesRegistry.getCapabilitiesMap()
            val result = pairingManager.pairWithCode(code, caps)

            btnPair.isEnabled = true
            btnPair.text = getString(R.string.btn_pair)

            if (result.isSuccess) {
                Toast.makeText(this@MainActivity, "¡Vinculación exitosa con Enlace!", Toast.LENGTH_LONG).show()
                etPairingCode.text.clear()
                refreshUIState()
                sendHeartbeat()
                syncPendingActionsInBg(showToast = true)
            } else {
                val err = result.exceptionOrNull()?.message ?: "Error al vincular"
                Toast.makeText(this@MainActivity, "Error: $err", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun sendHeartbeat() {
        CoroutineScope(Dispatchers.IO).launch {
            val caps = capabilitiesRegistry.getCapabilitiesMap()
            val perms = capabilitiesRegistry.getPermissionsMap()
            apiClient.sendHeartbeat("1.0.0", caps, perms)
        }
    }

    private fun syncPendingActionsInBg(showToast: Boolean = false) {
        if (!identityManager.isPaired()) return

        CoroutineScope(Dispatchers.Main).launch {
            val count = actionManager.syncPendingActions()
            if (showToast) {
                if (count > 0) {
                    Toast.makeText(this@MainActivity, "Sincronizadas $count acciones pendientes", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this@MainActivity, "Sin acciones pendientes", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun scheduleBackgroundSync() {
        if (!identityManager.isPaired()) return

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<BridgeSyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork(
            BridgeSyncWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }

    private fun refreshUIState() {
        val isPaired = identityManager.isPaired()
        if (isPaired) {
            tvStatus.text = "✅ Dispositivo Vinculado"
            tvStatus.setTextColor(android.graphics.Color.parseColor("#16A34A"))
            tvDeviceDetails.text = "ID Dispositivo: ${identityManager.getDeviceId()}\nUsuario ID: ${identityManager.getUserId()}"
            btnPair.visibility = View.GONE
            etPairingCode.visibility = View.GONE
            btnSyncNow.visibility = View.VISIBLE
            btnUnlink.visibility = View.VISIBLE
        } else {
            tvStatus.text = "❌ No Vinculado"
            tvStatus.setTextColor(android.graphics.Color.parseColor("#DC2626"))
            tvDeviceDetails.text = "Genera un código de vinculación en Enlace Web e ingrésalo a continuación."
            btnPair.visibility = View.VISIBLE
            etPairingCode.visibility = View.VISIBLE
            btnSyncNow.visibility = View.GONE
            btnUnlink.visibility = View.GONE
        }

        val caps = capabilitiesRegistry.getCapabilitiesMap()
        val capsFormatted = caps.entries.joinToString("\n") { "• ${it.key}: ${it.value}" }
        tvCapabilities.text = "Capacidades Nativas de Android:\n$capsFormatted"
    }

    private fun requestInitialPermissions() {
        val permissions = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(android.Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (permissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toTypedArray(), 101)
        }
    }
}
