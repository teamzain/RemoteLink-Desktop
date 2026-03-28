import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand Colors
  static const Color background = Color(0xFF080808);
  static const Color paper = Color(0xFF111111);
  static const Color primary = Color(0xFF2563EB);
  static const Color primaryLight = Color(0xFF3B82F6);
  static const Color accent = Color(0xFF1D4ED8);
  static const Color textPrimary = Colors.white;
  static const Color textSecondary = Color(0x73FFFFFF); // 45% white
  static const Color divider = Color(0x0FFFFFFF); // 6% white

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: background,
      primaryColor: primary,
      colorScheme: const ColorScheme.dark(
        primary: primary,
        secondary: primaryLight,
        surface: paper,
        error: Colors.redAccent,
      ),
      dividerTheme: const DividerThemeData(
        color: divider,
        thickness: 1,
      ),
      textTheme: GoogleFonts.interTextTheme(
        const TextTheme(
          headlineLarge: TextStyle(
            color: textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 32,
          ),
          headlineMedium: TextStyle(
            color: textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 24,
          ),
          titleLarge: TextStyle(
            color: textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 20,
          ),
          bodyLarge: TextStyle(
            color: textPrimary,
            fontSize: 16,
          ),
          bodyMedium: TextStyle(
            color: textSecondary,
            fontSize: 14,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: divider),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: paper,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: divider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: divider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primary, width: 2),
        ),
        labelStyle: const TextStyle(color: textSecondary),
        hintStyle: const TextStyle(color: textSecondary),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 16,
            letterSpacing: 0.5,
          ),
          elevation: 4,
          shadowColor: primary.withAlpha(89), // 0.35 * 255
        ),
      ),
    );
  }
}
