package com.enlace.bridge

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.enlace.bridge.auth.DeviceIdentityManager
import com.enlace.bridge.calls.CallBridgeManager

class MainActivity : AppCompatActivity() {

    private lateinit var identityManager: DeviceIdentityManager
    private lateinit var callManager: CallBridgeManager
    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var customView: android.view.View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (filePathCallback == null) return@registerForActivityResult
        val results: Array<Uri>? = if (result.resultCode == RESULT_OK && result.data != null) {
            val dataString = result.data?.dataString
            val clipData = result.data?.clipData
            if (clipData != null) {
                val uris = mutableListOf<Uri>()
                for (i in 0 until clipData.itemCount) {
                    uris.add(clipData.getItemAt(i).uri)
                }
                uris.toTypedArray()
            } else if (dataString != null) {
                arrayOf(Uri.parse(dataString))
            } else null
        } else null

        filePathCallback?.onReceiveValue(results)
        filePathCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        identityManager = DeviceIdentityManager(this)
        callManager = CallBridgeManager(this)

        setupUI()
        configureWebView()
        requestInitialPermissions()

        if (savedInstanceState == null) {
            val targetUrl = identityManager.getServerUrl()
            webView.loadUrl(targetUrl)
        } else {
            webView.restoreState(savedInstanceState)
        }

        // Handle Back button to navigate back in WebView history or exit fullscreen custom view
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (customView != null) {
                    hideCustomView()
                } else if (::webView.isInitialized && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.onResume()
        }
        CookieManager.getInstance().flush()
    }

    override fun onPause() {
        super.onPause()
        if (::webView.isInitialized) {
            webView.onPause()
        }
        CookieManager.getInstance().flush()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized) {
            webView.saveState(outState)
        }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun hideCustomView() {
        if (customView == null) return
        val root = window.decorView as FrameLayout
        root.removeView(customView)
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        if (::webView.isInitialized) {
            webView.visibility = android.view.View.VISIBLE
        }
    }

    private fun setupUI() {
        val rootLayout = FrameLayout(this)

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        rootLayout.addView(webView)

        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                12
            )
            max = 100
        }
        rootLayout.addView(progressBar)

        setContentView(rootLayout)
    }

    private fun configureWebView() {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.setGeolocationEnabled(true)
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(true)
        settings.builtInZoomControls = false

        // Custom User Agent suffix to identify Link App
        settings.userAgentString = settings.userAgentString + " LinkApp/1.0 (Android)"

        // Cookie Manager Persistence
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        // JavaScript Interface for Native Bridge
        webView.addJavascriptInterface(WebAppBridge(this), "AppBridge")

        // WebViewClient
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                val defaultHost = Uri.parse(identityManager.getServerUrl()).host ?: "link-axlc.onrender.com"

                return if (url.contains(defaultHost) || url.startsWith("file://") || url.startsWith("data:")) {
                    false // Open within WebView
                } else {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                    } catch (e: Exception) {
                        Toast.makeText(this@MainActivity, "No se pudo abrir el enlace", Toast.LENGTH_SHORT).show()
                    }
                    true
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = android.view.View.GONE
                CookieManager.getInstance().flush()
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    // Show a toast or gentle alert on connection error
                    Toast.makeText(this@MainActivity, "Comprueba tu conexión a Internet.", Toast.LENGTH_SHORT).show()
                }
            }
        }

        // WebChromeClient
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = android.view.View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = android.view.View.GONE
                }
            }

            override fun onShowCustomView(view: android.view.View?, callback: CustomViewCallback?) {
                if (customView != null) {
                    onHideCustomView()
                    return
                }
                customView = view
                customViewCallback = callback
                webView.visibility = android.view.View.GONE
                val root = window.decorView as FrameLayout
                root.addView(customView, FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                ))
            }

            override fun onHideCustomView() {
                this@MainActivity.hideCustomView()
            }

            override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback?.invoke(origin, true, false)
                } else {
                    ActivityCompat.requestPermissions(
                        this@MainActivity,
                        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                        LOCATION_PERMISSION_CODE
                    )
                    callback?.invoke(origin, true, false)
                }
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread {
                    val resources = request?.resources ?: return@runOnUiThread
                    val granted = mutableListOf<String>()

                    for (res in resources) {
                        if (res == PermissionRequest.RESOURCE_AUDIO_CAPTURE && ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            granted.add(res)
                        } else if (res == PermissionRequest.RESOURCE_VIDEO_CAPTURE && ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            granted.add(res)
                        }
                    }

                    if (granted.isNotEmpty()) {
                        request.grant(granted.toTypedArray())
                    } else {
                        request.grant(resources)
                    }
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }

                try {
                    filePickerLauncher.launch(intent)
                } catch (e: ActivityNotFoundException) {
                    this@MainActivity.filePathCallback = null
                    Toast.makeText(this@MainActivity, "No hay explorador de archivos disponible", Toast.LENGTH_SHORT).show()
                    return false
                }
                return true
            }
        }
    }

    private fun requestInitialPermissions() {
        val permissions = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
        if (permissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toTypedArray(), INITIAL_PERMISSIONS_CODE)
        }
    }

    inner class WebAppBridge(private val context: Context) {
        @JavascriptInterface
        fun vibrate(milliseconds: Long) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                    vibratorManager.defaultVibrator.vibrate(android.os.VibrationEffect.createOneShot(milliseconds, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(milliseconds)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun showIncomingCall(callId: String, callerName: String, callerAvatar: String, targetRoute: String) {
            callManager.showIncomingCallNotification(callId, callerName, callerAvatar, targetRoute)
        }

        @JavascriptInterface
        fun cancelCall() {
            callManager.cancelCallNotification()
        }

        @JavascriptInterface
        fun getAppVersion(): String {
            return "1.0.0"
        }

        @JavascriptInterface
        fun setScreenProtection(enabled: Boolean) {
            runOnUiThread {
                try {
                    if (enabled) {
                        window.setFlags(
                            WindowManager.LayoutParams.FLAG_SECURE,
                            WindowManager.LayoutParams.FLAG_SECURE
                        )
                    } else {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        @JavascriptInterface
        fun isNativeBridge(): Boolean {
            return true
        }
    }

    companion object {
        private const val INITIAL_PERMISSIONS_CODE = 101
        private const val LOCATION_PERMISSION_CODE = 102
    }
}
