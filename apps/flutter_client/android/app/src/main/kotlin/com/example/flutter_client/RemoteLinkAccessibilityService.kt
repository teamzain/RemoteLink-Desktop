package com.example.flutter_client

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat

class RemoteLinkAccessibilityService : AccessibilityService() {
    private val CHANNEL_ID = "remotelink_control"
    private val NOTIFICATION_ID = 101

    private var lastFocusState = false

    private fun getRealScreenSize(): Pair<Int, Int> {
        val windowManager = getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = windowManager.currentWindowMetrics.bounds
            return Pair(bounds.width(), bounds.height())
        } else {
            val display = windowManager.defaultDisplay
            val metrics = android.util.DisplayMetrics()
            display.getRealMetrics(metrics)
            return Pair(metrics.widthPixels, metrics.heightPixels)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        
        // Auto-click "Start now" on Media Projection dialog
        val rootNode = rootInActiveWindow ?: return
        
        // Android system often uses "Start now" for screen capture dialog
        val startNowNodes = rootNode.findAccessibilityNodeInfosByText("Start now")
        for (node in startNowNodes) {
            if (node.isClickable) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                Log.d("RemoteLink", "Auto-clicked 'Start now'")
            }
        }

        // Detect Input Focus for Auto-Keyboard
        if (event.eventType == AccessibilityEvent.TYPE_VIEW_FOCUSED || 
            event.eventType == AccessibilityEvent.TYPE_VIEW_CLICKED ||
            event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            
            val source = event.source
            val isInputFocused = source?.isEditable == true || 
                                 source?.className?.contains("EditText", ignoreCase = true) == true
            
            if (isInputFocused != lastFocusState) {
                lastFocusState = isInputFocused
                focusListener?.invoke(isInputFocused)
                Log.d("RemoteLink", "Input focus changed: $isInputFocused")
            }
        }
    }

    override fun onInterrupt() {}

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d("RemoteLink", "Accessibility Service Connected")
        
        createNotificationChannel()
        startForegroundServiceWithNotification()
        
        instance = this
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "RemoteLink Control"
            val descriptionText = "Ensures background connectivity for remote control"
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun startForegroundServiceWithNotification() {
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("RemoteLink Active")
            .setContentText("Listening for remote control commands")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, 
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    fun dispatchClick(xRatio: Float, yRatio: Float, duration: Long = 100L) {
        val (realWidth, realHeight) = getRealScreenSize()
        val x = (xRatio * realWidth).coerceIn(0f, realWidth.toFloat() - 1f)
        val y = (yRatio * realHeight).coerceIn(0f, realHeight.toFloat() - 1f)
        
        Log.d("RemoteLink", "Dispatching click at $x, $y (Ratio: $xRatio, $yRatio, Duration: $duration)")
        
        val clickPath = Path()
        clickPath.moveTo(x, y)
        val clickStroke = GestureDescription.StrokeDescription(clickPath, 0, duration)
        val clickBuilder = GestureDescription.Builder()
        clickBuilder.addStroke(clickStroke)
        dispatchGesture(clickBuilder.build(), null, null)
    }

    fun dispatchSwipe(startXRatio: Float, startYRatio: Float, endXRatio: Float, endYRatio: Float, duration: Long) {
        val (realWidth, realHeight) = getRealScreenSize()
        val startX = (startXRatio * realWidth).coerceIn(0f, realWidth.toFloat() - 1f)
        val startY = (startYRatio * realHeight).coerceIn(0f, realHeight.toFloat() - 1f)
        val endX = (endXRatio * realWidth).coerceIn(0f, realWidth.toFloat() - 1f)
        val endY = (endYRatio * realHeight).coerceIn(0f, realHeight.toFloat() - 1f)

        Log.d("RemoteLink", "Dispatching swipe from $startX, $startY to $endX, $endY")

        val sweepPath = Path()
        sweepPath.moveTo(startX, startY)
        sweepPath.lineTo(endX, endY)
        val swipeStroke = GestureDescription.StrokeDescription(sweepPath, 0, duration)
        val swipeBuilder = GestureDescription.Builder()
        swipeBuilder.addStroke(swipeStroke)
        dispatchGesture(swipeBuilder.build(), null, null)
    }

    companion object {
        var instance: RemoteLinkAccessibilityService? = null
        private var focusListener: ((Boolean) -> Unit)? = null

        fun setFocusListener(listener: (Boolean) -> Unit) {
            focusListener = listener
        }
    }
}
