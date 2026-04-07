package com.example.flutter_client

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.example.remotelink/control"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "isAccessibilityServiceEnabled" -> {
                    result.success(isAccessibilityServiceEnabled(this))
                }
                "openAccessibilitySettings" -> {
                    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                    startActivity(intent)
                    result.success(true)
                }
                "requestNotificationPermission" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 101)
                    }
                    result.success(true)
                }
                "startProjectionService" -> {
                    val intent = Intent(this, MediaProjectionService::class.java)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(intent)
                    } else {
                        startService(intent)
                    }
                    result.success(true)
                }
                "stopProjectionService" -> {
                    val intent = Intent(this, MediaProjectionService::class.java)
                    stopService(intent)
                    result.success(true)
                }
                "startBackgroundService" -> {
                    val intent = Intent(this, BackgroundService::class.java)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(intent)
                    } else {
                        startService(intent)
                    }
                    result.success(true)
                }
                "stopBackgroundService" -> {
                    val intent = Intent(this, BackgroundService::class.java)
                    stopService(intent)
                    result.success(true)
                }
                "dispatchClick" -> {
                    val x = call.argument<Double>("x")?.toFloat() ?: 0f
                    val y = call.argument<Double>("y")?.toFloat() ?: 0f
                    val duration = call.argument<Int>("duration")?.toLong() ?: 100L
                    RemoteLinkAccessibilityService.instance?.dispatchClick(x, y, duration)
                    result.success(true)
                }
                "dispatchSwipe" -> {
                    val startX = call.argument<Double>("startX")?.toFloat() ?: 0f
                    val startY = call.argument<Double>("startY")?.toFloat() ?: 0f
                    val endX = call.argument<Double>("endX")?.toFloat() ?: 0f
                    val endY = call.argument<Double>("endY")?.toFloat() ?: 0f
                    val duration = call.argument<Int>("duration")?.toLong() ?: 300L
                    RemoteLinkAccessibilityService.instance?.dispatchSwipe(startX, startY, endX, endY, duration)
                    result.success(true)
                }
                "performAction" -> {
                    val action = call.argument<String>("action")
                    when (action) {
                        "volume_up" -> {
                            val audioManager = getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
                            audioManager.adjustStreamVolume(android.media.AudioManager.STREAM_MUSIC, android.media.AudioManager.ADJUST_RAISE, android.media.AudioManager.FLAG_SHOW_UI)
                        }
                        "volume_down" -> {
                            val audioManager = getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
                            audioManager.adjustStreamVolume(android.media.AudioManager.STREAM_MUSIC, android.media.AudioManager.ADJUST_LOWER, android.media.AudioManager.FLAG_SHOW_UI)
                        }
                        "lock" -> {
                            RemoteLinkAccessibilityService.instance?.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN)
                        }
                        "wakeup" -> {
                            val powerManager = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                            @Suppress("DEPRECATION")
                            val wakeLock = powerManager.newWakeLock(
                                android.os.PowerManager.SCREEN_BRIGHT_WAKE_LOCK or android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP,
                                "RemoteLink:WakeUp"
                            )
                            wakeLock.acquire(3000)
                        }
                        "reboot", "shutdown" -> {
                            android.widget.Toast.makeText(this, "Remote $action request received. Power actions require system privileges.", android.widget.Toast.LENGTH_LONG).show()
                        }
                    }
                    result.success(true)
                }
                "setKeepScreenOn" -> {
                    val keepOn = call.argument<Boolean>("keepOn") ?: false
                    if (keepOn) {
                        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    } else {
                        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    }
                    result.success(true)
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }

    private fun isAccessibilityServiceEnabled(context: Context): Boolean {
        val serviceName = context.packageName + "/" + RemoteLinkAccessibilityService::class.java.canonicalName
        val accessibilityEnabled = try {
            Settings.Secure.getInt(context.contentResolver, Settings.Secure.ACCESSIBILITY_ENABLED)
        } catch (e: Settings.SettingNotFoundException) {
            0
        }
        val colonSplitter = TextUtils.SimpleStringSplitter(':')
        if (accessibilityEnabled == 1) {
            val settingValue = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
            if (settingValue != null) {
                colonSplitter.setString(settingValue)
                while (colonSplitter.hasNext()) {
                    val accessibilityService = colonSplitter.next()
                    if (accessibilityService.equals(serviceName, ignoreCase = true)) {
                        return true
                    }
                }
            }
        }
        return false
    }

    override fun onBackPressed() {
        // PREVENT APP KILL: Move to background instead of finishing
        // This keeps the Flutter engine and our hosting service alive.
        moveTaskToBack(true)
    }
}
