import { Tabs } from 'expo-router';
import React from 'react';
import { View, Platform } from 'react-native';
import { LayoutDashboard, Monitor, Radio, Bell, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E6E8EC',
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        },
        tabBarActiveTintColor: '#141718',
        tabBarInactiveTintColor: '#8E9295',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              {focused && <View style={{ width: 20, height: 2, backgroundColor: '#141718', marginBottom: 4, borderRadius: 1 }} />}
              <LayoutDashboard size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: 'Fleet',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              {focused && <View style={{ width: 20, height: 2, backgroundColor: '#141718', marginBottom: 4, borderRadius: 1 }} />}
              <Monitor size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="host"
        options={{
          title: 'Host',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              {focused && <View style={{ width: 20, height: 2, backgroundColor: '#141718', marginBottom: 4, borderRadius: 1 }} />}
              <Radio size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              {focused && <View style={{ width: 20, height: 2, backgroundColor: '#141718', marginBottom: 4, borderRadius: 1 }} />}
              <Bell size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center' }}>
              {focused && <View style={{ width: 20, height: 2, backgroundColor: '#141718', marginBottom: 4, borderRadius: 1 }} />}
              <User size={22} color={color} />
            </View>
          ),
        }}
      />
      {/* Hide the default explore tab if it exists */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
