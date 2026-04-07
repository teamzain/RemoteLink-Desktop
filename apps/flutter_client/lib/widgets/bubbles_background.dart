import 'package:flutter/material.dart';
import 'dart:math' as math;

class BubblesBackground extends StatelessWidget {
  final Widget child;
  const BubblesBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Bubble 1 (Blue Top Left)
        Positioned(
          left: -158,
          top: -171,
          child: Container(
            width: 402,
            height: 442,
            decoration: const BoxDecoration(
              color: Color(0xFF004BFE),
              shape: BoxShape.circle,
            ),
          ),
        ),

        // Bubble 2 (Light Blue Top Left Overlay)
        Positioned(
          left: -136,
          top: -171,
          child: Transform.rotate(
            angle: 158 * math.pi / 180,
            child: Container(
              width: 373,
              height: 442,
              decoration: const BoxDecoration(
                color: Color(0xFFD9E4FF),
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),

        // Bubble 3 (Small Blue Middle Right)
        Positioned(
          left: 281,
          top: 239,
          child: Transform.rotate(
            angle: -156 * math.pi / 180,
            child: Container(
              width: 137,
              height: 151,
              decoration: const BoxDecoration(
                color: Color(0xFF004BFE),
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),

        // Bubble 4 (Light Blue Bottom Center)
        Positioned(
          left: 87,
          top: 449,
          child: Transform.rotate(
            angle: 108 * math.pi / 180,
            child: Container(
              width: 373,
              height: 442,
              decoration: const BoxDecoration(
                color: Color(0xFFF2F5FE),
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),

        // Foreground content
        SafeArea(child: child),
      ],
    );
  }
}
