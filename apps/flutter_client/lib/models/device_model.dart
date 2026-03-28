class DeviceModel {
  final String id;
  final String name;
  final String accessKey;
  final String? osType;
  final bool isOnline;
  final String? lastSeen;

  DeviceModel({
    required this.id,
    required this.name,
    required this.accessKey,
    this.osType,
    this.isOnline = false,
    this.lastSeen,
  });

  factory DeviceModel.fromJson(Map<String, dynamic> json) {
    return DeviceModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? 'Unknown',
      accessKey: json['access_key'] ?? '',
      osType: json['os_type'],
      isOnline: json['is_online'] ?? false,
      lastSeen: json['last_seen'],
    );
  }
}
