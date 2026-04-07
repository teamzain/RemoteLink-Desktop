import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Link } from 'lucide-react-native';

interface LogoProps {
  size?: number;
  color?: string;
}

export const Logo = ({ size = 120, color = "#141718" }: LogoProps) => {
  return (
    <View style={styles.container}>
      <Link size={size} color={color} strokeWidth={2} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
