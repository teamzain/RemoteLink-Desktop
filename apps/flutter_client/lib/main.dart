import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/device_provider.dart';
import 'providers/host_provider.dart';
import 'providers/session_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/snow_splash.dart';
import 'screens/dashboard/dashboard_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProxyProvider<AuthProvider, DeviceProvider>(
          create: (context) => DeviceProvider(context.read<AuthProvider>()),
          update: (context, auth, previous) => DeviceProvider(auth),
        ),
        ChangeNotifierProxyProvider<AuthProvider, HostProvider>(
          create: (context) => HostProvider(context.read<AuthProvider>()),
          update: (context, auth, previous) => HostProvider(auth),
        ),
        ChangeNotifierProxyProvider<AuthProvider, SessionProvider>(
          create: (context) => SessionProvider(context.read<AuthProvider>()),
          update: (context, auth, previous) => SessionProvider(auth),
        ),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SyncLink',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          if (auth.isLoading) {
            return const SnowSplash();
          }
          return auth.isAuthenticated ? const DashboardScreen() : const LoginScreen();
        },
      ),
    );
  }
}

