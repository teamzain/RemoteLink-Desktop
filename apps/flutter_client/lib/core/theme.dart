import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // --- Snow Premium Light Branding Tokens ---
  static const Color background = Color(0xFFF8F9FA); // Soft Off-White
  static const Color bottomNavBackground = Color(0xFFFFFFFF); // Clean White
  static const Color surface = Color(0xFFFFFFFF);    // Pure White
  static const Color surfaceAccent = Color(0xFFF1F3F5); // Lifted Gray
  static const Color primary = Color(0xFF1C1C1C);    // Primary text
  static const Color accent = Color(0xFF3B82F6);     // Electric Blue
  static const Color success = Color(0xFF10B981);    // Emerald
  static const Color warning = Color(0xFFF59E0B);    // Amber
  
  static const Color textPrimary = Color(0xFF1C1C1C);  // Charcoal
  static const Color textSecondary = Color(0x991C1C1C); // 60% charcoal
  static const Color textMuted = Color(0x4D1C1C1C);    // 30% charcoal
  
  static const Color divider = Color(0xFFE9ECEF);      // Subtle border
  static const Color surfaceBorder = Color(0xFFDEE2E6); // Defined border

  // --- SnowUI Radius Tokens ---
  static const double radiusXL = 32.0;
  static const double radiusLarge = 24.0;
  static const double radiusMedium = 16.0;
  static const double radiusSmall = 12.0;

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light, 
      scaffoldBackgroundColor: background,
      primaryColor: accent,
      colorScheme: const ColorScheme.light(
        primary: accent,
        secondary: accent,
        surface: surface,
        onSurface: textPrimary,
        onPrimary: Colors.white,
        error: Color(0xFFEF4444),
      ),
      dividerTheme: const DividerThemeData(
        color: divider,
        thickness: 1,
      ),
      textTheme: GoogleFonts.interTextTheme(
        const TextTheme(
          displayLarge: TextStyle(
            color: textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 32,
            letterSpacing: -1.5,
          ),
          headlineLarge: TextStyle(
            color: textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 24,
            letterSpacing: -0.5,
          ),
          headlineMedium: TextStyle(
            color: textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 20,
          ),
          titleLarge: TextStyle(
            color: textPrimary,
            fontWeight: FontWeight.w600,
            fontSize: 18,
          ),
          bodyLarge: TextStyle(
            color: textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
          bodyMedium: TextStyle(
            color: textSecondary,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
          labelSmall: TextStyle(
            color: textMuted,
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.5,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLarge),
          side: const BorderSide(color: divider),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSmall),
          borderSide: const BorderSide(color: divider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSmall),
          borderSide: const BorderSide(color: divider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSmall),
          borderSide: const BorderSide(color: accent, width: 1.5),
        ),
        labelStyle: const TextStyle(color: textSecondary, fontSize: 13, fontWeight: FontWeight.bold),
        hintStyle: const TextStyle(color: textMuted, fontSize: 13),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 56),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusLarge),
          ),
          textStyle: const TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 13,
            letterSpacing: 1.5,
          ),
        ),
      ),
    );
  }

  static ThemeData get darkTheme => lightTheme; 
}
