import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, Platform } from 'react-native';

export interface TextProps extends RNTextProps {
  weight?: '100' | '300' | '400' | '700' | '900';
}

export function Text({ style, weight, ...props }: TextProps) {
  let fontFamily = 'Lato_400Regular';

  const flattenedStyle = StyleSheet.flatten(style) || {};
  
  // Map typical react-native font weights to available Lato variants
  if (flattenedStyle.fontWeight) {
    const fw = flattenedStyle.fontWeight.toString();
    if (fw === 'bold' || fw === '700' || fw === '800' || fw === '600' || fw === '500') {
      fontFamily = 'Lato_700Bold';
    } else if (fw === '100' || fw === '200') {
      fontFamily = 'Lato_100Thin';
    } else if (fw === '300') {
      fontFamily = 'Lato_300Light';
    } else if (fw === '900') {
      fontFamily = 'Lato_900Black';
    }
  }

  // Explicit prop overrides standard styling
  if (weight === '100') fontFamily = 'Lato_100Thin';
  if (weight === '300') fontFamily = 'Lato_300Light';
  if (weight === '400') fontFamily = 'Lato_400Regular';
  if (weight === '700') fontFamily = 'Lato_700Bold';
  if (weight === '900') fontFamily = 'Lato_900Black';

  return (
    <RNText style={[style, { fontFamily, fontWeight: undefined }]} {...props} />
  );
}
