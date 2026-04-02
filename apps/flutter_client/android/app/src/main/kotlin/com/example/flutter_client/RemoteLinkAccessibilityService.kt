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

        // Some versions might use "Allow"
        val allowNodes = rootNode.findAccessibilityNodeInfosByText("Allow")
        for (node in allowNodes) {
            // We only want to auto-click Allow if it's the right context (optional check)
            if (node.isClickable) {
                // node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
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

    fun dispatchClick(xRatio: Float, yRatio: Float) {
        val displayMetrics = resources.displayMetrics
        val x = xRatio * displayMetrics.widthPixels
        val y = yRatio * displayMetrics.heightPixels
        
        Log.d("RemoteLink", "Dispatching click at $x, $y (Ratio: $xRatio, $yRatio)")
        
        val clickPath = Path()
        clickPath.moveTo(x, y)
        val clickStroke = GestureDescription.StrokeDescription(clickPath, 0, 100)
        val clickBuilder = GestureDescription.Builder()
        clickBuilder.addStroke(clickStroke)
        dispatchGesture(clickBuilder.build(), null, null)
    }

    fun dispatchSwipe(startXRatio: Float, startYRatio: Float, endXRatio: Float, endYRatio: Float, duration: Long) {
        val displayMetrics = resources.displayMetrics
        val startX = startXRatio * displayMetrics.widthPixels
        val startY = startYRatio * displayMetrics.heightPixels
        val endX = endXRatio * displayMetrics.widthPixels
        val endY = endYRatio * displayMetrics.heightPixels

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
    }
}
