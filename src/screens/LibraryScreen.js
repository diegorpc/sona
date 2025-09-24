import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ScrollView,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Text, ActivityIndicator, Searchbar, Card } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import CacheService from '../services/CacheService';
import { theme } from '../theme/theme';
import { styles } from '../styles/LibraryScreen.styles';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
const CHIP_DEFINITIONS = [
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' },
  { key: 'liked', label: 'Liked Songs' },
  { key: 'playlists', label: 'Playlists' },
];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LibraryScreen({ navigation }) {
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [songs, setSongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('liked'); // 'artists', 'albums', 'liked', 'playlists'
  const [isSearchActive, setIsSearchActive] = useState(false);

  const chipScrollRef = useRef(null);
  const listOpacity = useRef(new Animated.Value(1)).current;
  const isAnimatingList = useRef(false);
  const hasLoadedInitialData = useRef(false);

  const animateListOpacityTo = useCallback(
    (toValue, duration = 140) =>
      new Promise(resolve => {
        Animated.timing(listOpacity, {
          toValue,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => resolve());
      }),
    [listOpacity]
  );

  const loadLibraryData = useCallback(async (shouldAnimate = true, forceRefresh = false) => {
    try {
      // Only set loading state if this is the initial load
      if (!hasLoadedInitialData.current) {
        setIsLoading(true);
      }

      // Check cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cachedArtists = CacheService.get('artists');
        const cachedAlbums = CacheService.get('albums');
        const cachedSongs = CacheService.get('songs');
        const cachedLikedSongs = CacheService.get('likedSongs');
        const cachedPlaylists = CacheService.get('playlists');

        if (cachedArtists && cachedAlbums && cachedSongs && cachedLikedSongs && cachedPlaylists) {
          console.log('Loading from cache...');
          setArtists(cachedArtists);
          setAlbums(cachedAlbums);
          setSongs(cachedSongs);
          setLikedSongs(cachedLikedSongs);
          setPlaylists(cachedPlaylists);
          
          setIsLoading(false);
          hasLoadedInitialData.current = true;
          
          if (shouldAnimate) {
            await animateListOpacityTo(1, 180);
          }
          return;
        }
      }

      console.log('Loading from API...');
      
      // Load artists
      let allArtists = CacheService.get('artists');
      if (!allArtists || forceRefresh) {
        const artistsData = await SubsonicAPI.getArtists();
        allArtists = [];
        if (artistsData && artistsData.index) {
          artistsData.index.forEach(indexGroup => {
            if (indexGroup.artist) {
              allArtists.push(...indexGroup.artist);
            }
          });
        }
        CacheService.set('artists', allArtists);
      }
      setArtists(allArtists);

      // Load albums from all artists
      let allAlbums = CacheService.get('albums');
      if (!allAlbums || forceRefresh) {
        allAlbums = [];
        for (const artist of allArtists.slice(0, 20)) { // Limit for performance
          try {
            const artistData = await SubsonicAPI.getArtist(artist.id);
            if (artistData && artistData.album) {
              allAlbums.push(...artistData.album);
            }
          } catch (error) {
            console.warn(`Error loading albums for artist ${artist.name}:`, error);
          }
        }
        CacheService.set('albums', allAlbums);
      }
      setAlbums(allAlbums);

      // Load liked/starred songs
      let likedSongsData = CacheService.get('likedSongs');
      if (!likedSongsData || forceRefresh) {
        try {
          const starredData = await SubsonicAPI.getStarred();
          likedSongsData = starredData && starredData.song ? starredData.song : [];
          CacheService.set('likedSongs', likedSongsData);
        } catch (error) {
          console.warn('Error loading liked songs:', error);
          likedSongsData = [];
        }
      }
      setLikedSongs(likedSongsData);

      // Load playlists
      let playlistsData = CacheService.get('playlists');
      if (!playlistsData || forceRefresh) {
        try {
          const playlistsResponse = await SubsonicAPI.getPlaylists();
          playlistsData = playlistsResponse && playlistsResponse.playlist ? playlistsResponse.playlist : [];
          CacheService.set('playlists', playlistsData);
        } catch (error) {
          console.warn('Error loading playlists:', error);
          playlistsData = [];
        }
      }
      setPlaylists(playlistsData);

    } catch (error) {
      console.error('Error loading library:', error);
    } finally {
      setIsLoading(false);
      hasLoadedInitialData.current = true;
      
      // Only auto-animate if requested (for initial load and refresh)
      if (shouldAnimate) {
        await animateListOpacityTo(1, 180);
      }
    }
  }, [animateListOpacityTo]);

  useEffect(() => {
    loadLibraryData(false);
  }, [loadLibraryData]);

  const chipOrder = useMemo(() => {
    const selected = CHIP_DEFINITIONS.find(chip => chip.key === viewMode);
    if (!selected) {
      return CHIP_DEFINITIONS;
    }
    return [selected, ...CHIP_DEFINITIONS.filter(chip => chip.key !== viewMode)];
  }, [viewMode]);

  const filteredData = useMemo(() => {
    const dataByView = {
      artists,
      albums,
      liked: likedSongs,
      playlists,
    };

    const searchFieldByView = {
      artists: 'name',
      albums: 'name',
      liked: 'title',
      playlists: 'name',
    };

    const baseData = (dataByView[viewMode] || []).filter(Boolean);

    const seenKeys = new Set();
    const deduplicated = baseData.filter(item => {
      const key = item?.id ?? item?.name ?? item?.title;
      if (!key) {
        return true;
      }
      if (seenKeys.has(key)) {
        return false;
      }
      seenKeys.add(key);
      return true;
    });

    const searchField = searchFieldByView[viewMode] || 'name';
    if (!searchQuery) {
      return deduplicated;
    }

    const normalizedQuery = searchQuery.toLowerCase();
    return deduplicated.filter(item => {
      const value = item?.[searchField];
      return value ? value.toLowerCase().includes(normalizedQuery) : false;
    });
  }, [albums, artists, viewMode, likedSongs, playlists, searchQuery]);


  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLibraryData(true, true); // Force refresh to bypass cache
    setIsRefreshing(false);
  };

  const handleViewModePress = useCallback(async (mode) => {
    if (mode === viewMode || isAnimatingList.current) {
      return;
    }

    isAnimatingList.current = true;
    
    try {
      // STEP 1: Update view mode immediately (no animation)
      setViewMode(mode);
      
      // Scroll chips to start position instantly
      chipScrollRef.current?.scrollTo({ x: 0, animated: false });
      
      // Fade out the library content 
      await animateListOpacityTo(0, 700);
      
      // Do the query (load data)
      await loadLibraryData(false); // Don't animate here, we'll do it manually

      // Fade in the library once data is ready
      await animateListOpacityTo(1, 700);
      
    } catch (error) {
      console.error('Error in view mode transition:', error);
      // Ensure we fade back in even if there's an error
      await animateListOpacityTo(1, 700);
    } finally {
      isAnimatingList.current = false;
    }
    
  }, [viewMode, animateListOpacityTo, loadLibraryData]);

  const openSearch = useCallback(() => {
    setIsSearchActive(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery('');
  }, []);

  const handleItemPress = (item, index) => {
    switch (viewMode) {
      case 'artists':
        navigation.navigate('Artist', { artist: item });
        break;
      case 'albums':
        navigation.navigate('Album', { album: item });
        break;
      case 'liked':
        AudioPlayer.playTrack(item, filteredData, index);
        navigation.navigate('Player');
        break;
      case 'playlists':
        console.log('Playlist pressed:', item.name);
        break;
      default:
        break;
    }
  };

  const getImageUrl = (item) => {
    switch (viewMode) {
      case 'artists':
        return item.artistImageUrl || (item.coverArt ? SubsonicAPI.getCoverArtUrl(item.coverArt, 100) : null);
      case 'albums':
      case 'liked':
        return item.coverArt ? SubsonicAPI.getCoverArtUrl(item.coverArt, 100) : null;
      case 'playlists':
        return null; // TODO
      default:
        return null;
    }
  };

  const renderItem = ({ item, index }) => {
    let title, subtitle, iconName;
    
    switch (viewMode) {
      case 'artists':
        title = item.name;
        subtitle = `${item.albumCount} album${item.albumCount !== 1 ? 's' : ''}`;
        iconName = 'chevron-right';
        break;
      case 'albums':
        title = item.name;
        subtitle = item.artist || 'Unknown Artist';
        iconName = 'chevron-right';
        break;
      case 'liked':
        title = item.title;
        subtitle = item.artist || 'Unknown Artist';
        iconName = 'play-arrow';
        break;
      case 'playlists':
        title = item.name;
        subtitle = `${item.songCount || 0} song${(item.songCount || 0) !== 1 ? 's' : ''}`;
        iconName = 'chevron-right';
        break;
    }
    
    const imageUrl = getImageUrl(item);
    
    return (
      <TouchableOpacity onPress={() => handleItemPress(item, index)}>
        <Card style={styles.itemCard}>
          <View style={styles.itemContent}>
            <Image
              source={imageUrl ? { uri: imageUrl } : require('../../assets/default-album.png')}
              style={styles.itemImage}
              defaultSource={require('../../assets/default-album.png')}
            />
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{title}</Text>
              <Text style={styles.itemSubtitle}>{subtitle}</Text>
            </View>
            <MaterialIcons 
              name={iconName} 
              size={24} 
              color={theme.colors.onSurface} 
            />
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const keyExtractor = useCallback((item, index) => {
    const baseKey = item?.id ?? item?.name ?? item?.title ?? `item-${index}`;
    return `${viewMode}-${baseKey}-${index}`;
  }, [viewMode]);

  const renderEmptyState = () => {
    const emptyMessages = {
      artists: { text: 'No artists found', icon: 'person' },
      albums: { text: 'No albums found', icon: 'album' },
      liked: { text: 'No liked songs found', icon: 'favorite' },
      playlists: { text: 'No playlists found', icon: 'playlist-music' }
    };
    
    const { text, icon } = emptyMessages[viewMode];
    
    return (
      <View style={styles.emptyState}>
        <MaterialIcons name={icon} size={64} color={theme.colors.outline} />
        <Text style={styles.emptyText}>{text}</Text>
        <Text style={styles.emptySubtext}>
          {searchQuery ? 'Try a different search term' : 'Your library appears to be empty'}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading your library...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {isSearchActive ? (
          <Searchbar
            autoFocus
            placeholder={`Search ${viewMode}...`}
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
            icon="chevron-left"
            onIconPress={closeSearch}
            inputStyle={styles.searchbarInput}
            onClearIconPress={() => setSearchQuery('')}
          />
        ) : (
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Your Library</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open search"
              style={styles.headerAction}
              onPress={openSearch}
            >
              <MaterialIcons name="search" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>
        )}

        {!isSearchActive && (
          <ScrollView
            horizontal
            ref={chipScrollRef}
            showsHorizontalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            style={styles.chipScrollContainer}
            contentContainerStyle={styles.chipContainer}
          >
            {chipOrder.map(({ key, label }) => {
              const isActive = viewMode === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => handleViewModePress(key)}
                  style={[
                    styles.bubbleChip,
                    isActive ? styles.bubbleChipSelected : styles.bubbleChipUnselected,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleChipText,
                      isActive ? styles.bubbleChipTextSelected : styles.bubbleChipTextUnselected,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      <AnimatedFlatList
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        style={{ opacity: listOpacity }}
      />
    </View>
  );
}

