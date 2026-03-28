import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/device_provider.dart';
import 'providers/host_provider.dart';
import 'screens/auth/login_screen.dart';
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
      title: 'RemoteLink',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          if (auth.isLoading) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          return auth.isAuthenticated ? const DashboardScreen() : const LoginScreen();
        },
      ),
    );
  }
}
