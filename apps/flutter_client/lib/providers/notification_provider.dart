import 'package:flutter/foundation.dart';

class AppNotification {
  final String id;
  final String title;
  final String message;
  final String type;
  final String timestamp;
  bool isRead;

  AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.timestamp,
    this.isRead = false,
  });
}

class NotificationProvider extends ChangeNotifier {
  List<AppNotification> _notifications = [
    AppNotification(
      id: '1',
      title: 'New device connected',
      message: 'Windows Desktop was newly authenticated.',
      type: 'SYSTEM',
      timestamp: '2 mins ago',
    ),
    AppNotification(
      id: '2',
      title: 'Security alert',
      message: 'Unrecognized login attempt blocked.',
      type: 'SECURITY',
      timestamp: '1 hour ago',
    ),
    AppNotification(
      id: '3',
      title: 'Payment successful',
      message: 'Your Pro subscription renewed successfully.',
      type: 'BILLING',
      timestamp: 'Yesterday',
      isRead: true,
    ),
  ];

  List<AppNotification> get notifications => _notifications;

  void markAsRead(String id) {
    final index = _notifications.indexWhere((n) => n.id == id);
    if (index != -1) {
      _notifications[index].isRead = true;
      notifyListeners();
    }
  }

  void clearAll() {
    _notifications.clear();
    notifyListeners();
  }
}
