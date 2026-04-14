package com.example.flutter_client

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class MediaProjectionService : Service() {
    companion object {
        private const val CHANNEL_ID = "MediaProjectionServiceChannel"
        private const val NOTIFICATION_ID = 2
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification()
        
        // Android 14 (API 34+) Requirement: 
        // 1. Service must be declared with mediaProjection type in manifest (Done)
        // 2. startForeground MUST be called with mediaProjection type before capture starts.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                startForeground(
                    NOTIFICATION_ID, 
                    notification, 
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                )
            } catch (e: Exception) {
                e.printStackTrace()
                // Fallback for standard FGS if mediaProjection fails
                try {
                    startForeground(NOTIFICATION_ID, notification)
                } catch (e2: Exception) {}
            }
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Sharing Active")
            .setContentText("RemoteLink is capturing your screen.")
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Media Projection Service Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(serviceChannel)
        }
    }
}
