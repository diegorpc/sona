import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import {
  useFonts,
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
} from '@expo-google-fonts/lexend';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import SearchScreen from './src/screens/SearchScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ArtistScreen from './src/screens/ArtistScreen';
import AlbumScreen from './src/screens/AlbumScreen';
import SubsonicAPI from './src/services/SubsonicAPI';
import PlaylistScreen from './src/screens/PlaylistScreen';
import { navigationRef } from './src/services/NavigationService';

import PlayerOverlay from './src/components/PlayerOverlay';
import { PlayerProvider } from './src/contexts/PlayerContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createStackNavigator();
const LibraryStack = createStackNavigator();
const SearchStack = createStackNavigator();

const detailScreenOptions = { headerShown: false };

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeHome" component={HomeScreen} />
      <HomeStack.Screen name="Artist" component={ArtistScreen} options={detailScreenOptions} />
      <HomeStack.Screen name="Album" component={AlbumScreen} options={detailScreenOptions} />
      <HomeStack.Screen name="Playlist" component={PlaylistScreen} options={detailScreenOptions} />
    </HomeStack.Navigator>
  );
}

function LibraryStackNavigator() {
  return (
    <LibraryStack.Navigator screenOptions={{ headerShown: false }}>
      <LibraryStack.Screen name="LibraryHome" component={LibraryScreen} />
      <LibraryStack.Screen name="Artist" component={ArtistScreen} options={detailScreenOptions} />
      <LibraryStack.Screen name="Album" component={AlbumScreen} options={detailScreenOptions} />
      <LibraryStack.Screen name="Playlist" component={PlaylistScreen} options={detailScreenOptions} />
    </LibraryStack.Navigator>
  );
}

function SearchStackNavigator() {
  return (
    <SearchStack.Navigator screenOptions={{ headerShown: false }}>
      <SearchStack.Screen name="SearchHome" component={SearchScreen} />
      <SearchStack.Screen name="Artist" component={ArtistScreen} options={detailScreenOptions} />
      <SearchStack.Screen name="Album" component={AlbumScreen} options={detailScreenOptions} />
      <SearchStack.Screen name="Playlist" component={PlaylistScreen} options={detailScreenOptions} />
    </SearchStack.Navigator>
  );
}

function MainTabs() {
  const { theme } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Library') {
            iconName = 'library-music';
          } else if (route.name === 'Search') {
            iconName = 'search';
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
          borderTopWidth: 1,
        },
        headerShown: false,
      })}
      sceneContainerStyle={{
        backgroundColor: 'transparent',
      }}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} options={{ tabBarLabelStyle: { fontSize: 12, fontWeight: 500, fontFamily: 'Lexend' } }} />
      <Tab.Screen name="Library" component={LibraryStackNavigator} options={{ tabBarLabelStyle: { fontSize: 12, fontWeight: 500, fontFamily: 'Lexend' } }} />
      <Tab.Screen name="Search" component={SearchStackNavigator} options={{ tabBarLabelStyle: { fontSize: 12, fontWeight: 500, fontFamily: 'Lexend' } }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabelStyle: { fontSize: 12, fontWeight: 500, fontFamily: 'Lexend' } }} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const serverConfig = await AsyncStorage.getItem('serverConfig');
      if (serverConfig) {
        const configLoaded = await SubsonicAPI.loadConfiguration();
        if (configLoaded) {
          setIsLoggedIn(true);
        } else {
          await AsyncStorage.removeItem('serverConfig');
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Error checking login status:', error);
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null;
  }

  const handleNavigationStateChange = () => {
    checkLoginStatus();
  };

  return (
    <PaperProvider theme={theme}>
      <PlayerProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <NavigationContainer ref={navigationRef} onStateChange={handleNavigationStateChange}>
              <StatusBar style="auto" />
              <Stack.Navigator
                screenOptions={{
                  headerStyle: {
                    backgroundColor: theme.colors.surface,
                  },
                  headerTintColor: theme.colors.onSurface,
                }}
              >
                {!isLoggedIn ? (
                  <Stack.Screen
                    name="Login"
                    options={{ headerShown: false }}
                  >
                    {(props) => <LoginScreen {...props} onLoginSuccess={checkLoginStatus} />}
                  </Stack.Screen>
                ) : (
                  <>
                    <Stack.Screen
                      name="Main"
                      component={MainTabs}
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen name="Artist" component={ArtistScreen} options={detailScreenOptions} />
                    <Stack.Screen name="Album" component={AlbumScreen} options={detailScreenOptions} />
                  </>
                )}
              </Stack.Navigator>
            </NavigationContainer>
            <PlayerOverlay />
          </View>
        </GestureHandlerRootView>
      </PlayerProvider>
    </PaperProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
