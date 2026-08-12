import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ScrollView,
  Animated,
  Easing,
  Pressable,
  Dimensions,
  InteractionManager,
} from 'react-native';
import { Text, ActivityIndicator, Searchbar } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { getPlaylistPlayTimes, compareByRecentlyListened } from '../services/RecentPlaylists';
import { getRandomAlbums } from '../services/RandomAlbums';
import ScreenBackground from '../components/ScreenBackground';
import SongMenu from '../components/SongMenu';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import ArtworkCache from '../services/ArtworkCache';
import CacheService from '../services/CacheService';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import PlaylistCollage from '../components/PlaylistCollage';
import { useCurrentTrack, usePlayerActions } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/LibraryScreen.styles';
import { createStyles as createMenuStyles } from '../styles/SongMenu.styles';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedText = Animated.createAnimatedComponent(Text);
const AnimatedHeader = Animated.createAnimatedComponent(View);
const DEFAULT_ART = require('../../assets/default-album.png');
const CHIP_DEFINITIONS = [
  { key: 'liked', label: 'Liked Songs' },
  { key: 'playlists', label: 'Playlists' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
];

// Sort options for liked songs
const LIKED_SORT_OPTIONS = [
  { key: 'recentlyListened', label: 'Recently Listened', icon: 'history' },
  { key: 'recentlyAdded', label: 'Recently Added', icon: 'library-add' },
  { key: 'dateLoved', label: 'Date Loved', icon: 'favorite' },
  { key: 'alphabetical', label: 'Alphabetical', icon: 'sort-by-alpha' },
];

// Sort options for playlists
const PLAYLIST_SORT_OPTIONS = [
  { key: 'recentlyListened', label: 'Recently Listened', icon: 'history' },
  { key: 'default', label: 'Default', icon: 'list' },
  { key: 'alphabetical', label: 'Alphabetical', icon: 'sort-by-alpha' },
  { key: 'dateCreated', label: 'Date Created', icon: 'schedule' },
];

// Sort options for artists
const ARTIST_SORT_OPTIONS = [
  { key: 'alphabetical', label: 'Alphabetical', icon: 'sort-by-alpha' },
  { key: 'albumCount', label: 'Album Count', icon: 'album' },
];

// Sort options for albums
const ALBUM_SORT_OPTIONS = [
  { key: 'recent', label: 'Recently Listened', icon: 'history' },
  { key: 'newest', label: 'Recently Added', icon: 'new-releases' },
  { key: 'frequent', label: 'Most Listened', icon: 'repeat' },
  { key: 'alphabetical', label: 'Alphabetical', icon: 'sort-by-alpha' },
  { key: 'dateReleased', label: 'Date Released', icon: 'event' },
  { key: 'random', label: 'Random', icon: 'shuffle' },
];

const DEFAULT_SORT_OPTION = 'dateLoved';
const LIKED_DEFAULT_SORT_OPTION = 'dateLoved';
const PLAYLIST_DEFAULT_SORT_OPTION = 'alphabetical';
const ARTIST_DEFAULT_SORT_OPTION = 'alphabetical';
const ALBUM_DEFAULT_SORT_OPTION = 'newest';

const DEFAULT_SORT_BY_VIEW = {
  liked: LIKED_DEFAULT_SORT_OPTION,
  playlists: PLAYLIST_DEFAULT_SORT_OPTION,
  artists: ARTIST_DEFAULT_SORT_OPTION,
  albums: ALBUM_DEFAULT_SORT_OPTION,
};

const ALBUM_SORT_TYPE_MAP = {
  recent: 'recent',
  newest: 'newest',
  frequent: 'frequent',
  alphabetical: 'alphabeticalByName',
  random: 'random',
};

const ALL_SORT_OPTIONS = [
  ...LIKED_SORT_OPTIONS,
  ...PLAYLIST_SORT_OPTIONS,
  ...ARTIST_SORT_OPTIONS,
  ...ALBUM_SORT_OPTIONS,
];

const SORT_OPTION_LABELS = ALL_SORT_OPTIONS.reduce((acc, option) => {
  acc[option.key] = option.label;
  return acc;
}, {});

const ALPHABETICAL_COMPARE_OPTIONS = { sensitivity: 'base' };

const getItemDisplayName = (item, mode) => {
  if (!item) {
    return '';
  }

  switch (mode) {
    case 'liked':
      return item.title || item.name || '';
    case 'albums':
    case 'artists':
    case 'playlists':
      return item.name || item.title || '';
    default:
      return item.name || item.title || '';
  }
};

const getFirstAvailableTimestamp = (item, fields) => {
  if (!item) {
    return 0;
  }

  for (const field of fields) {
    const value = item[field];
    if (!value) {
      continue;
    }

    if (typeof value === 'number') {
      return value;
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const CHIP_FADE_OUT_DURATION = 200;
const CHIP_FADE_IN_DURATION = 240;
const CHIP_REORDER_DURATION = 620;
const CHIP_SECTION_DEFAULT_HEIGHT = 36;
const LIST_ITEM_HEIGHT = 72;

const buildChipOrder = (selectedKey) => {
  const selected = CHIP_DEFINITIONS.find(chip => chip.key === selectedKey);
  if (!selected) {
    return CHIP_DEFINITIONS;
  }
  return [selected, ...CHIP_DEFINITIONS.filter(chip => chip.key !== selectedKey)];
};

const formatItemDuration = (seconds) => {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
};

const DEFAULT_LIST_IMAGE = require('../../assets/default-album.png');

const LIBRARY_THUMB_SIZE = 52;
const SWIPE_ACTION_WIDTH = 80;

const SwipeAddLast = memo(({ progress, theme }) => {
  const menuStyles = createMenuStyles(theme);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SWIPE_ACTION_WIDTH, 0],
    extrapolate: 'clamp',
  });
  return (
    <View style={menuStyles.swipeAction}>
      <Animated.View style={[menuStyles.swipeActionContent, { transform: [{ translateX }] }]}>
        <MaterialIcons name="queue-music" size={22} color={theme.colors.onPrimary} />
        <Text style={menuStyles.swipeActionLabel}>Add last</Text>
      </Animated.View>
    </View>
  );
});

// Hoisted to module scope so memoization actually works across LibraryScreen renders.
const ListItem = memo(function ListItem({
  item,
  index,
  viewMode,
  styles,
  primaryColor,
  collageData,
  isPlaying,
  theme,
  onPress,
  onMenuPress,
  onLongPress,
  onAddLast,
}) {
  const swipeRef = useRef(null);

  const handlePress = useCallback(() => {
    onPress(item, index);
  }, [onPress, item, index]);

  const handleMenuPressCallback = useCallback(() => {
    onMenuPress(item);
  }, [onMenuPress, item]);

  const handleLongPress = useCallback(() => {
    if (onLongPress) onLongPress(item);
  }, [onLongPress, item]);

  const renderRightActions = useCallback((progress) => (
    viewMode === 'liked' ? <SwipeAddLast progress={progress} theme={theme} /> : null
  ), [viewMode, theme]);

  const handleSwipeOpen = useCallback(() => {
    if (onAddLast) onAddLast(item);
    swipeRef.current?.close();
  }, [item, onAddLast]);

  const title = viewMode === 'liked' ? item.title : item.name;

  const subtitle = useMemo(() => {
    switch (viewMode) {
      case 'artists':
        return `${item.albumCount} album${item.albumCount !== 1 ? 's' : ''}`;
      case 'albums':
      case 'liked':
        return item.artist || 'Unknown Artist';
      case 'playlists':
        return `${item.songCount || 0} song${(item.songCount || 0) !== 1 ? 's' : ''}`;
      default:
        return '';
    }
  }, [viewMode, item.albumCount, item.artist, item.songCount]);

  // Resolve image: prefer direct coverArt art (disk-cached via ArtworkCache);
  // for playlists fall back to a 2x2 collage when there's no coverArt id.
  const imageData = useMemo(() => {
    if (viewMode === 'artists') {
      return item?.id ? ArtworkCache.getArtworkSource(item.id, 200) : null;
    }
    if (viewMode === 'albums' || viewMode === 'liked') {
      return item.coverArt ? ArtworkCache.getArtworkSource(item.coverArt, 200) : null;
    }
    if (viewMode === 'playlists') {
      // Newer Subsonic servers expose a real playlist cover art id; prefer it over the
      // generated collage and only fall back to the collage when none exists.
      if (item.coverArt) return ArtworkCache.getArtworkSource(item.coverArt, 200);
      return collageData || null;
    }
    return null;
  }, [viewMode, item.id, item.coverArt, collageData]);

  const duration = useMemo(
    () => (item.duration ? formatItemDuration(item.duration) : ''),
    [item.duration]
  );

  const showDuration = viewMode === 'liked' || viewMode === 'albums' || viewMode === 'playlists';
  const showMenu = viewMode === 'liked';

  const isRoundImage = viewMode === 'artists';

  const imageComponent = useMemo(() => {
    if (imageData && typeof imageData === 'object' && imageData.type === 'collage') {
      return (
        <View style={styles.itemImageContainer}>
          <PlaylistCollage collageData={imageData} size={LIBRARY_THUMB_SIZE} />
        </View>
      );
    }
    const source = typeof imageData === 'string'
      ? { uri: imageData, cache: 'force-cache' }
      : (imageData?.uri ? imageData : null);
    return (
      <View style={styles.itemImageContainer}>
        <Image
          source={source || DEFAULT_LIST_IMAGE}
          style={isRoundImage
            ? { width: LIBRARY_THUMB_SIZE, height: LIBRARY_THUMB_SIZE, borderRadius: LIBRARY_THUMB_SIZE / 2 }
            : { width: LIBRARY_THUMB_SIZE, height: LIBRARY_THUMB_SIZE, borderRadius: 5 }
          }
          resizeMode="contain"
          defaultSource={DEFAULT_LIST_IMAGE}
          fadeDuration={200}
        />
      </View>
    );
  }, [imageData, styles.itemImageContainer, isRoundImage]);

  const row = (
    <TouchableOpacity
      style={[styles.flatListItem, isPlaying && styles.flatListItemPlaying]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={350}
      activeOpacity={0.7}
    >
      {viewMode === 'liked' && (
        <MaterialIcons
          name="favorite"
          size={14}
          color={primaryColor}
          style={styles.itemLeadingIcon}
        />
      )}
      {imageComponent}
      <View style={styles.itemInfo}>
        <Text style={[styles.itemTitle, isPlaying && styles.itemTitlePlaying]}>{title}</Text>
        <Text style={[styles.itemSubtitle, isPlaying && styles.itemSubtitlePlaying]}>{subtitle}</Text>
      </View>

      {(showDuration || showMenu) && (
        <View style={styles.itemRightContent}>
          {showDuration && duration && (
            <Text style={styles.itemDuration}>{duration}</Text>
          )}
          {showMenu && (
            <TouchableOpacity
              style={styles.itemMenuButton}
              onPress={handleMenuPressCallback}
              activeOpacity={0.7}
            >
              <Text style={styles.itemMenuDots}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  if (viewMode === 'liked') {
    return (
      <Swipeable
        ref={swipeRef}
        renderRightActions={renderRightActions}
        onSwipeableOpen={handleSwipeOpen}
        rightThreshold={60}
        overshootRight={false}
        friction={2}
      >
        {row}
      </Swipeable>
    );
  }

  return row;
}, (prev, next) => {
  return (
    prev.item === next.item &&
    prev.index === next.index &&
    prev.viewMode === next.viewMode &&
    prev.styles === next.styles &&
    prev.primaryColor === next.primaryColor &&
    prev.collageData === next.collageData &&
    prev.isPlaying === next.isPlaying &&
    prev.theme === next.theme &&
    prev.onPress === next.onPress &&
    prev.onMenuPress === next.onMenuPress &&
    prev.onLongPress === next.onLongPress &&
    prev.onAddLast === next.onAddLast
  );
});

export default function LibraryScreen({ navigation, route }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Deep-link entry (e.g. "See All" from Home): land on a specific tab + sort.
  const initialTab = route?.params?.initialTab || 'liked';
  const initialSort = route?.params?.initialSort || DEFAULT_SORT_BY_VIEW[initialTab] || DEFAULT_SORT_OPTION;
  const { playTrack, insertIntoPriorityQueue, appendToContextQueue } = usePlayerActions();
  const currentTrack = useCurrentTrack();
  const [menuSong, setMenuSong] = useState(null);
  const [addToPlaylistSong, setAddToPlaylistSong] = useState(null);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playlistPlayTimes, setPlaylistPlayTimes] = useState({});
  const [playlistCollages, setPlaylistCollages] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState(initialTab); // 'liked', 'playlists', 'albums', 'artists'
  const [chipDisplayOrder, setChipDisplayOrder] = useState(() => buildChipOrder(initialTab));
  const [activeChip, setActiveChip] = useState(initialTab);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [headerContentWidth, setHeaderContentWidth] = useState(0);
  const [sortOption, setSortOption] = useState(initialSort);
  const [sortDirection, setSortDirection] = useState('desc');
  const [isSortMenuVisible, setIsSortMenuVisible] = useState(false);
  const [sortMenuAnchor, setSortMenuAnchor] = useState(null);
  
  // Pagination state
  const [displayedData, setDisplayedData] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = 50;
  const loadMoreTimeoutRef = useRef(null);
  const isScrollingRef = useRef(false);
  const flatListRef = useRef(null);
  
  const chipScrollRef = useRef(null);
  const sortTriggerRef = useRef(null);
  const listOpacity = useRef(new Animated.Value(0)).current; // Start at 0 to prevent flash
  const isAnimatingList = useRef(false);
  const hasLoadedInitialData = useRef(false);
  const currentViewModeData = useRef(null); // Track current view data to prevent race conditions
  const chipAnimations = useRef({}).current;
  const chipHighlightAnimations = useRef({}).current;
  const previousActiveChipRef = useRef(initialTab);
  const chipLayoutsRef = useRef({});
  const pendingChipAnimation = useRef(null);
  const searchReveal = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef(null);
  const chipSectionProgress = useRef(new Animated.Value(1)).current;
  const [chipSectionHeight, setChipSectionHeight] = useState(CHIP_SECTION_DEFAULT_HEIGHT);
  const sortMenuAnimation = useRef(new Animated.Value(0)).current;

  const createSortComparator = useCallback((targetSortOption, targetViewMode, direction = 'desc') => {
    const d = direction === 'asc' ? -1 : 1;

    const alphabeticalCompare = (a, b) => {
      const aName = getItemDisplayName(a, targetViewMode).toLowerCase();
      const bName = getItemDisplayName(b, targetViewMode).toLowerCase();
      return d * aName.localeCompare(bName, undefined, ALPHABETICAL_COMPARE_OPTIONS);
    };

    if (targetSortOption === 'alphabetical') return alphabeticalCompare;

    if (targetViewMode === 'playlists') {
      if (targetSortOption === 'default') return () => 0;
      if (targetSortOption === 'recentlyListened') {
        const compare = compareByRecentlyListened(playlistPlayTimes);
        return (a, b) => d * compare(a, b);
      }
      if (targetSortOption === 'dateCreated') {
        const dateFields = ['created', 'dateAdded', 'dateCreated'];
        return (a, b) => {
          const aValue = getFirstAvailableTimestamp(a, dateFields);
          const bValue = getFirstAvailableTimestamp(b, dateFields);
          if (aValue !== bValue) return d * (bValue - aValue);
          return alphabeticalCompare(a, b);
        };
      }
      return alphabeticalCompare;
    }

    if (targetViewMode === 'artists') {
      if (targetSortOption === 'albumCount') {
        return (a, b) => {
          const aCount = a?.albumCount || 0;
          const bCount = b?.albumCount || 0;
          if (aCount !== bCount) return d * (bCount - aCount);
          return alphabeticalCompare(a, b);
        };
      }
      return alphabeticalCompare;
    }

    if (targetViewMode === 'albums') {
      if (targetSortOption === 'alphabetical') return alphabeticalCompare;
      if (targetSortOption === 'dateReleased') {
        return (a, b) => {
          const aYear = a?.year || 0;
          const bYear = b?.year || 0;
          if (aYear !== bYear) return d * (bYear - aYear);
          return alphabeticalCompare(a, b);
        };
      }
      // recent / newest / frequent: API provides the order; reversal handled in fullFilteredData
      return () => 0;
    }

    if (targetSortOption === 'recentlyAdded') {
      const dateFields = ['created', 'dateAdded', 'dateCreated', 'updated', 'starred'];
      return (a, b) => {
        const aValue = getFirstAvailableTimestamp(a, dateFields);
        const bValue = getFirstAvailableTimestamp(b, dateFields);
        if (aValue !== bValue) return d * (bValue - aValue);
        return alphabeticalCompare(a, b);
      };
    }

    if (targetSortOption === 'dateLoved') {
      const dateFields = ['starred', 'dateLoved', 'dateFavorited', 'created', 'dateAdded'];
      return (a, b) => {
        const aValue = getFirstAvailableTimestamp(a, dateFields);
        const bValue = getFirstAvailableTimestamp(b, dateFields);
        if (aValue !== bValue) return d * (bValue - aValue);
        return alphabeticalCompare(a, b);
      };
    }

    // Default: recently listened
    const dateFields = ['lastPlayed', 'playedDate', 'played', 'recentPlayed', 'created'];
    return (a, b) => {
      const aValue = getFirstAvailableTimestamp(a, dateFields);
      const bValue = getFirstAvailableTimestamp(b, dateFields);
      if (aValue !== bValue) return d * (bValue - aValue);
      const aCount = typeof a?.playCount === 'number' ? a.playCount : (a?.songCount ?? 0);
      const bCount = typeof b?.playCount === 'number' ? b.playCount : (b?.songCount ?? 0);
      if (aCount !== bCount) return d * (bCount - aCount);
      return alphabeticalCompare(a, b);
    };
  }, [playlistPlayTimes]);

  const sortComparator = useMemo(() => {
    return createSortComparator(sortOption, viewMode, sortDirection);
  }, [sortOption, viewMode, sortDirection, createSortComparator]);

  const sortOptions = useMemo(() => {
    switch (viewMode) {
      case 'liked':
        return LIKED_SORT_OPTIONS;
      case 'playlists':
        return PLAYLIST_SORT_OPTIONS;
      case 'artists':
        return ARTIST_SORT_OPTIONS;
      case 'albums':
        return ALBUM_SORT_OPTIONS;
      default:
        return LIKED_SORT_OPTIONS;
    }
  }, [viewMode]);

  useEffect(() => {
    chipDisplayOrder.forEach(({ key }) => {
      if (!chipAnimations[key]) {
        chipAnimations[key] = new Animated.Value(0);
      }
      if (!chipHighlightAnimations[key]) {
        chipHighlightAnimations[key] = new Animated.Value(activeChip === key ? 1 : 0);
      }
    });
  }, [chipDisplayOrder, chipAnimations, chipHighlightAnimations, activeChip]);

  useEffect(() => {
    const previousActiveChip = previousActiveChipRef.current;
    const currentAnimation = chipHighlightAnimations[activeChip];

    if (!currentAnimation) {
      previousActiveChipRef.current = activeChip;
      return;
    }

    if (!previousActiveChip || previousActiveChip === activeChip) {
      currentAnimation.stopAnimation();
      currentAnimation.setValue(1);
      previousActiveChipRef.current = activeChip;
      return;
    }

    const prevAnimation = chipHighlightAnimations[previousActiveChip];

    // Stop any ongoing animations to prevent conflicts
    currentAnimation.stopAnimation();
    if (prevAnimation) {
      prevAnimation.stopAnimation();
    }

    // Run color animations in parallel for immediate feedback
    const animations = [];

    if (prevAnimation) {
      animations.push(
        Animated.timing(prevAnimation, {
          toValue: 0,
          duration: CHIP_FADE_OUT_DURATION,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        })
      );
    }

    animations.push(
      Animated.timing(currentAnimation, {
        toValue: 1,
        duration: CHIP_FADE_IN_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      })
    );

    Animated.parallel(animations).start();

    previousActiveChipRef.current = activeChip;
  }, [activeChip, chipHighlightAnimations]);

  // Track previous view mode to detect actual changes
  const previousViewModeRef = useRef(viewMode);
  const pendingViewModeChange = useRef(null);

  useEffect(() => {
    // Only reset sort when view mode actually changes
    if (previousViewModeRef.current !== viewMode) {
      const defaultSortByView = {
        liked: LIKED_DEFAULT_SORT_OPTION,
        playlists: PLAYLIST_DEFAULT_SORT_OPTION,
        artists: ARTIST_DEFAULT_SORT_OPTION,
        albums: ALBUM_DEFAULT_SORT_OPTION,
      };

      const defaultSort = defaultSortByView[viewMode] || DEFAULT_SORT_OPTION;
      setSortOption(defaultSort);
      setSortDirection('desc');

      previousViewModeRef.current = viewMode;
    }
  }, [viewMode]);


  const animateListOpacityTo = useCallback(
    (toValue, duration = 300) =>
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
      // Initialize cache service
      await CacheService.initialize();
      
      // Only set loading state if this is the initial load
      if (!hasLoadedInitialData.current) {
        setIsLoading(true);
      }

      // Check cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cachedArtists = await CacheService.getAsync('artists');
        const cachedAlbums = await CacheService.getAsync(`albums_${sortOption}`);
        const cachedLikedSongs = await CacheService.getAsync('likedSongs');
        const cachedPlaylists = await CacheService.getAsync('playlists');
        const cachedPlaylistCollages = await CacheService.getAsync('playlistCollages');

        if (cachedArtists && cachedAlbums && cachedLikedSongs && cachedPlaylists) {
          setArtists(cachedArtists);
          setAlbums(cachedAlbums);
          setLikedSongs(cachedLikedSongs);
          setPlaylists(cachedPlaylists);
          setPlaylistCollages(cachedPlaylistCollages || {});
          
          const wasInitialLoad = !hasLoadedInitialData.current;
          setIsLoading(false);
          hasLoadedInitialData.current = true;
          
          // Always animate on initial load to fade in from opacity 0
          if (shouldAnimate || wasInitialLoad) {
            await new Promise(resolve => requestAnimationFrame(resolve));
            await animateListOpacityTo(1, 400);
          }
          return;
        }
      }

      // Load artists
      let allArtists = await CacheService.getAsync('artists');
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
        await CacheService.set('artists', allArtists);
      }
      setArtists(allArtists);
      // Artist images are resolved per-row via ArtworkCache (see imageData
      // below) — same disk-backed cache as every other cover art in the app,
      // instead of a separate AsyncStorage map of resolved URL strings.

      // Load albums using proper API with sort type.
      // Random is fetched fresh (single batch, never cached) so it reshuffles each load.
      let allAlbums;
      if (sortOption === 'random') {
        // Shared, persisted random ordering (same as Home); reset only via refresh.
        try {
          allAlbums = await getRandomAlbums();
        } catch (error) {
          console.error('Error loading random albums:', error);
          allAlbums = [];
        }
      } else {
        const albumCacheKey = `albums_${sortOption}`;
        allAlbums = await CacheService.getAsync(albumCacheKey);

        if (!allAlbums || forceRefresh) {
          const apiSortType = ALBUM_SORT_TYPE_MAP[sortOption] || 'recent';
          console.log(`Loading albums with sort type: ${apiSortType}`);

          try {
            allAlbums = await SubsonicAPI.getAllAlbums(apiSortType, 2000);
            await CacheService.set(albumCacheKey, allAlbums);
          } catch (error) {
            console.error('Error loading albums:', error);
            allAlbums = [];
          }
        }
      }
      setAlbums(allAlbums);

      // Load liked/starred songs
      let likedSongsData = await CacheService.getAsync('likedSongs');
      if (!likedSongsData || forceRefresh) {
        try {
          const starredData = await SubsonicAPI.getStarred();
          likedSongsData = starredData && starredData.song ? starredData.song : [];
          await CacheService.set('likedSongs', likedSongsData);
        } catch (error) {
          console.error('Error loading liked songs:', error);
          likedSongsData = [];
        }
      }
      setLikedSongs(likedSongsData);

      // Load playlists
      let playlistsData = await CacheService.getAsync('playlists');
      if (!playlistsData || forceRefresh) {
        try {
          const playlistsResponse = await SubsonicAPI.getPlaylists();
          playlistsData = playlistsResponse && playlistsResponse.playlist ? playlistsResponse.playlist : [];
          await CacheService.set('playlists', playlistsData);
        } catch (error) {
          console.error('Error loading playlists:', error);
          playlistsData = [];
        }
      }
      setPlaylists(playlistsData);

      // Load cached playlist collages immediately (non-blocking)
      let cachedCollages = await CacheService.getAsync('playlistCollages') || {};
      setPlaylistCollages(cachedCollages);

    } catch (error) {
      console.error('Error loading library:', error);
    } finally {
      setIsLoading(false);
      hasLoadedInitialData.current = true;
      
      if (shouldAnimate) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        await animateListOpacityTo(1, 400);
      }
    }
  }, [animateListOpacityTo, sortOption]);

  // Load albums with specific sort when needed - returns the albums directly
  const loadAlbumsWithSort = useCallback(async (albumSortOption) => {
    try {
      // Shared, persisted random ordering (same as Home); reset only via refresh.
      if (albumSortOption === 'random') {
        const randomAlbums = await getRandomAlbums();
        setAlbums(randomAlbums);
        return randomAlbums;
      }

      const albumCacheKey = `albums_${albumSortOption}`;
      let allAlbums = await CacheService.getAsync(albumCacheKey);

      if (!allAlbums) {
        const apiSortType = ALBUM_SORT_TYPE_MAP[albumSortOption] || 'recent';
        console.log(`Loading albums with sort type: ${apiSortType}`);

        allAlbums = await SubsonicAPI.getAllAlbums(apiSortType, 2000);
        await CacheService.set(albumCacheKey, allAlbums);
      }

      setAlbums(allAlbums);
      return allAlbums; // Return the albums for immediate use
    } catch (error) {
      console.error('Error loading albums with sort:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    const initializeAndLoad = async () => {
      // Ensure SubsonicAPI is initialized before loading data
      const isConfigured = await SubsonicAPI.loadConfiguration();
      if (isConfigured) {
        loadLibraryData(true); // Animate on initial load to fade in from opacity 0
      } else {
        console.error('SubsonicAPI not configured. Redirecting to login...');
        // Handle case where API is not configured
      }
    };
    
    initializeAndLoad();
    
    // Cleanup timeout on unmount
    return () => {
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }
    };
  }, [loadLibraryData]);


  const handleChipLayout = useCallback(
    (key) => (event) => {
      const { x, width } = event.nativeEvent.layout;
      chipLayoutsRef.current[key] = { x, width };

      const pending = pendingChipAnimation.current;
      if (pending && Object.prototype.hasOwnProperty.call(pending, key)) {
        const previous = pending[key];
        const delta = previous ? previous.x - x : 0;

        if (!chipAnimations[key]) {
          chipAnimations[key] = new Animated.Value(0);
        }

        if (delta !== 0) {
          chipAnimations[key].setValue(delta);
          Animated.timing(chipAnimations[key], {
            toValue: 0,
            duration: CHIP_REORDER_DURATION,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        } else {
          chipAnimations[key].setValue(0);
        }

        delete pending[key];
        if (Object.keys(pending).length === 0) {
          pendingChipAnimation.current = null;
        }
      }
    },
    [chipAnimations]
  );

  // full query for search
  const fullFilteredData = useMemo(() => {
    const dataByView = {
      artists,
      albums,
      liked: likedSongs,
      playlists,
    };

    const baseData = dataByView[viewMode] || [];
    
    // Store current view data to prevent race conditions
    currentViewModeData.current = baseData;
    
    if (baseData.length === 0) {
      return [];
    }

    const uniqueItems = [];
    const seenKeys = new Set();

    baseData.forEach(item => {
      if (!item) {
        return;
      }

      const key = item.id ?? item.name ?? item.title;
      if (!key || seenKeys.has(key)) {
        return;
      }

      seenKeys.add(key);
      uniqueItems.push(item);
    });

    let filteredItems = uniqueItems;

    if (searchQuery) {
      const searchFieldByView = {
        artists: 'name',
        albums: 'name',
        liked: 'title',
        playlists: 'name',
      };

      const searchField = searchFieldByView[viewMode] || 'name';
      const normalizedQuery = searchQuery.toLowerCase();

      filteredItems = uniqueItems.filter(item => {
        if (!item) {
          return false;
        }

        const value = item[searchField];
        if (typeof value !== 'string') {
          return false;
        }

        return value.toLowerCase().includes(normalizedQuery);
      });
    }

    let sortedItems = filteredItems.slice().sort(sortComparator);

    // API-ordered album sorts (recent/newest/frequent) can't be reversed via comparator;
    // flip the already-ordered array when ascending direction is requested.
    if (viewMode === 'albums' && ['recent', 'newest', 'frequent'].includes(sortOption) && sortDirection === 'asc') {
      sortedItems = sortedItems.slice().reverse();
    }

    return sortedItems;
  }, [albums, artists, viewMode, likedSongs, playlists, searchQuery, sortComparator, sortOption, sortDirection]);

  // Paginated data for display (when not searching)
  const paginatedData = useMemo(() => {
    if (searchQuery) {
      return fullFilteredData;
    }
    
    const endIndex = (currentPage + 1) * ITEMS_PER_PAGE;
    return fullFilteredData.slice(0, endIndex);
  }, [fullFilteredData, currentPage, searchQuery, ITEMS_PER_PAGE]);

  // Update displayed data when paginated data changes
  useEffect(() => {
    // Don't update during view transitions to prevent race conditions
    if (isAnimatingList.current || pendingViewModeChange.current) {
      return;
    }
    
    // Batch state updates together
    const hasMore = paginatedData.length < fullFilteredData.length;
    
    // Use InteractionManager to defer update if actively scrolling
    if (isScrollingRef.current) {
      InteractionManager.runAfterInteractions(() => {
        // Double-check animation state before updating
        if (!isAnimatingList.current && !pendingViewModeChange.current) {
          setDisplayedData(paginatedData);
          setHasMoreData(hasMore);
        }
      });
    } else {
      setDisplayedData(paginatedData);
      setHasMoreData(hasMore);
    }
  }, [paginatedData, fullFilteredData]);

  // Reset pagination when view mode or search changes
  useEffect(() => {
    setCurrentPage(0);
    // Don't clear displayedData immediately during view mode transitions
    // Let the fade animation handle the visual transition
    // Also don't clear when search is active to prevent empty state flash
    if (!isAnimatingList.current && !isSearchActive) {
      setDisplayedData([]);
    }
  }, [viewMode, searchQuery, isSearchActive]);


  const handleRefresh = async () => {
    setIsRefreshing(true);
    setCurrentPage(0); // Reset pagination on refresh
    await loadLibraryData(true, true); // Force refresh to bypass cache
    setIsRefreshing(false);
  };

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMoreData || searchQuery) {
      return;
    }
    
    // Clear any existing timeout
    if (loadMoreTimeoutRef.current) {
      clearTimeout(loadMoreTimeoutRef.current);
    }
    
    setIsLoadingMore(true);
    
    // Use InteractionManager to wait for scroll animations to finish
    loadMoreTimeoutRef.current = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        setCurrentPage(prev => prev + 1);
        setIsLoadingMore(false);
      });
    }, 300); // Increased debounce to prevent rapid firing during scroll
  }, [isLoadingMore, hasMoreData, searchQuery]);
  
  // Track scroll state to prevent updates during active scrolling
  const handleScrollBeginDrag = useCallback(() => {
    isScrollingRef.current = true;
  }, []);
  
  const handleScrollEndDrag = useCallback(() => {
    // Keep scrolling flag active briefly after drag ends
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 500);
  }, []);
  
  const handleMomentumScrollEnd = useCallback(() => {
    isScrollingRef.current = false;
  }, []);

  const runViewModeTransition = useCallback(async (mode, sortOverride = null) => {
    try {
      // Mark transition as pending
      pendingViewModeChange.current = mode;

      // Fade out the library content FIRST
      await animateListOpacityTo(0, 300);

      // Clear displayed data immediately to prevent flash
      setDisplayedData([]);

      // Use an explicit sort when deep-linked (e.g. "See All" from Home),
      // otherwise fall back to the tab's default sort.
      const targetSort = sortOverride || DEFAULT_SORT_BY_VIEW[mode] || DEFAULT_SORT_OPTION;
      
      // For albums, load the correct sort data BEFORE switching
      let albumsForMode = albums;
      if (mode === 'albums') {
        albumsForMode = await loadAlbumsWithSort(targetSort);
      }
      
      // Check if we need to load other data
      const dataByView = {
        artists,
        albums: albumsForMode,
        liked: likedSongs,
        playlists,
      };
      
      const hasDataForMode = (dataByView[mode] || []).length > 0;
      
      if (!hasDataForMode && mode !== 'albums') {
        // Only reload data if we don't have it cached (albums already loaded above)
        await loadLibraryData(false);
        
        // Refresh data after loading
        if (mode === 'albums') {
          albumsForMode = albums;
        }
      }
      
      // Prepare the correct sorted data BEFORE changing view mode
      const dataForNewMode = {
        artists,
        albums: albumsForMode,
        liked: likedSongs,
        playlists,
      };
      
      const baseData = dataForNewMode[mode] || [];
      const comparator = createSortComparator(targetSort, mode, 'desc');
      const sortedData = baseData.slice().sort(comparator);
      const paginatedNewData = sortedData.slice(0, ITEMS_PER_PAGE);
      
      // NOW change view mode and update data atomically.
      // Set previousViewModeRef first so the sort-reset effect doesn't clobber targetSort.
      previousViewModeRef.current = mode;
      setViewMode(mode);
      setSortOption(targetSort);
      setSortDirection('desc');
      setCurrentPage(0);
      setDisplayedData(paginatedNewData);
      setHasMoreData(sortedData.length > ITEMS_PER_PAGE);
      
      // Scroll to top
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      
      // Wait for React to complete full render with correct viewMode + data
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fade in the library once everything is ready and rendered
      await animateListOpacityTo(1, 400);
      
      pendingViewModeChange.current = null;
      
    } catch (error) {
      console.error('Error in view mode transition:', error);
      setViewMode(mode);
      await animateListOpacityTo(1, 400);
      pendingViewModeChange.current = null;
    } finally {
      isAnimatingList.current = false;
    }
  }, [animateListOpacityTo, loadLibraryData, artists, albums, likedSongs, playlists, createSortComparator]);

  const handleViewModePress = useCallback((mode) => {
    if (mode === activeChip || isAnimatingList.current) {
      return;
    }

    if (isSortMenuVisible) {
      closeSortMenu();
    }

    isAnimatingList.current = true;

    // Start chip color changes IMMEDIATELY for instant visual feedback
    setActiveChip(mode);

    // Capture current layouts for animation
    const previousLayouts = Object.keys(chipLayoutsRef.current).reduce((acc, key) => {
      acc[key] = { ...chipLayoutsRef.current[key] };
      return acc;
    }, {});
    pendingChipAnimation.current = previousLayouts;

    const nextOrder = buildChipOrder(mode);

    // Start chip reordering animation immediately
    setChipDisplayOrder(nextOrder);
    
    // Scroll chips to start position immediately
    chipScrollRef.current?.scrollTo({ x: 0, animated: true });

    // Start the data transition immediately in parallel with chip animations
    runViewModeTransition(mode);

  }, [activeChip, runViewModeTransition, isSortMenuVisible, closeSortMenu]);

  // Switch tab + sort together, used for deep-links from Home ("See All").
  // Unlike handleViewModePress it allows the same tab with a different sort.
  const applyDeepLink = useCallback((mode, sort) => {
    if (isAnimatingList.current) {
      return;
    }

    const targetSort = sort || DEFAULT_SORT_BY_VIEW[mode] || DEFAULT_SORT_OPTION;
    if (mode === activeChip && targetSort === sortOption) {
      return;
    }

    if (isSortMenuVisible) {
      closeSortMenu();
    }

    isAnimatingList.current = true;
    setActiveChip(mode);

    const previousLayouts = Object.keys(chipLayoutsRef.current).reduce((acc, key) => {
      acc[key] = { ...chipLayoutsRef.current[key] };
      return acc;
    }, {});
    pendingChipAnimation.current = previousLayouts;

    setChipDisplayOrder(buildChipOrder(mode));
    chipScrollRef.current?.scrollTo({ x: 0, animated: true });

    runViewModeTransition(mode, targetSort);
  }, [activeChip, sortOption, runViewModeTransition, isSortMenuVisible, closeSortMenu]);

  // Consume deep-link params on focus. A fresh mount already initializes from
  // route.params via useState, so only apply here when the screen was already
  // mounted (i.e. returning to the Library tab via "See All").
  useFocusEffect(
    useCallback(() => {
      const tab = route?.params?.initialTab;
      if (!tab) {
        return;
      }
      if (hasLoadedInitialData.current) {
        applyDeepLink(tab, route?.params?.initialSort || null);
      }
      navigation.setParams({ initialTab: undefined, initialSort: undefined });
    }, [route?.params?.initialTab, route?.params?.initialSort, applyDeepLink, navigation])
  );

  // Keep playlist listen-times fresh so the "Recently Listened" sort reflects
  // playlists played since the screen mounted.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getPlaylistPlayTimes().then(times => { if (active) setPlaylistPlayTimes(times); });
      return () => { active = false; };
    }, [])
  );

  const handleHeaderLayout = useCallback(({ nativeEvent }) => {
    const width = nativeEvent?.layout?.width ?? 0;
    setHeaderContentWidth(prev => (Math.abs(prev - width) < 0.5 ? prev : width));
  }, []);

  const handleChipSectionLayout = useCallback(({ nativeEvent }) => {
    const height = nativeEvent?.layout?.height ?? 0;
    if (height <= 0) {
      return;
    }

    setChipSectionHeight(prev => {
      if (!prev || height > prev * 0.98) {
        return height;
      }
      return prev;
    });
  }, []);

  const openSearch = useCallback(() => {
    if (isSortMenuVisible) {
      closeSortMenu();
    }

    if (isSearchActive) {
      searchInputRef.current?.focus();
      return;
    }
    Animated.parallel([
      Animated.timing(searchReveal, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(chipSectionProgress, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsSearchActive(true);
      searchInputRef.current?.focus();
    });
  }, [chipSectionProgress, isSearchActive, searchReveal, isSortMenuVisible, closeSortMenu]);

  const closeSearch = useCallback(() => {
    searchInputRef.current?.blur?.();
    
    Animated.parallel([
      Animated.timing(searchReveal, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(chipSectionProgress, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsSearchActive(false);
      // Clear search query after animation completes and search is inactive
      setSearchQuery('');
    });
  }, [chipSectionProgress, searchReveal]);

  const closeSortMenu = useCallback(() => {
    if (!isSortMenuVisible) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      Animated.timing(sortMenuAnimation, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setIsSortMenuVisible(false);
        setSortMenuAnchor(null);
        resolve();
      });
    });
  }, [isSortMenuVisible, sortMenuAnimation]);

  const handleSortOptionSelect = useCallback(async (optionKey) => {
    if (isAnimatingList.current) {
      return;
    }

    if (optionKey === sortOption) {
      await closeSortMenu();
      return;
    }

    isAnimatingList.current = true;

    await closeSortMenu();

    try {
      // Fade out
      await animateListOpacityTo(0, 300);
      
      // Clear displayed data to prevent flash
      setDisplayedData([]);
      
      // Scroll to top
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      
      // If changing album sort, load albums with new sort and get them directly
      let albumsForSort = albums;
      if (viewMode === 'albums') {
        albumsForSort = await loadAlbumsWithSort(optionKey);
      }
      
      // Get fresh sorted data with the new sort option using the correct albums
      const dataByView = {
        artists,
        albums: albumsForSort,
        liked: likedSongs,
        playlists,
      };
      const baseData = dataByView[viewMode] || [];
      const comparator = createSortComparator(optionKey, viewMode, sortDirection);
      const sortedData = baseData.slice().sort(comparator);
      const paginatedNewData = sortedData.slice(0, ITEMS_PER_PAGE);
      
      // Update all state atomically
      setSortOption(optionKey);
      setCurrentPage(0);
      setDisplayedData(paginatedNewData);
      setHasMoreData(sortedData.length > ITEMS_PER_PAGE);
      
      // Wait for React to complete full render cycle with new data
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fade in with correct data already rendered
      await animateListOpacityTo(1, 400);
    } catch (error) {
      console.error('Error applying sort option:', error);
      await animateListOpacityTo(1, 400);
    } finally {
      isAnimatingList.current = false;
    }
  }, [animateListOpacityTo, sortOption, sortDirection, closeSortMenu, viewMode, loadAlbumsWithSort, artists, albums, likedSongs, playlists, createSortComparator]);

  const showSortOptions = useCallback(() => {
    if (isAnimatingList.current) {
      return;
    }

    if (isSortMenuVisible) {
      closeSortMenu();
      return;
    }

    const openMenu = (anchor) => {
      setSortMenuAnchor(anchor);
      setIsSortMenuVisible(true);
      sortMenuAnimation.stopAnimation();
      sortMenuAnimation.setValue(0);
      Animated.timing(sortMenuAnimation, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    if (sortTriggerRef.current?.measureInWindow) {
      sortTriggerRef.current.measureInWindow((x, y, width, height) => {
        const windowWidth = Dimensions.get('window').width;
        const menuWidth = 220;
        const horizontalMargin = 16;
        const left = Math.min(
          Math.max(x + width - menuWidth, horizontalMargin),
          windowWidth - menuWidth - horizontalMargin
        );
        const top = Math.max(y + height-40, horizontalMargin);

        openMenu({ top, left });
      });
    } else {
      const windowWidth = Dimensions.get('window').width;
      openMenu({ top: 100, left: windowWidth - 220 - 16 });
    }
  }, [closeSortMenu, isSortMenuVisible, sortMenuAnimation]);

  const handleSortDirectionToggle = useCallback(async () => {
    if (isAnimatingList.current) return;
    isAnimatingList.current = true;
    const newDirection = sortDirection === 'desc' ? 'asc' : 'desc';

    await animateListOpacityTo(0, 180);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });

    const dataByView = { artists, albums, liked: likedSongs, playlists };
    const baseData = dataByView[viewMode] || [];
    const comparator = createSortComparator(sortOption, viewMode, newDirection);
    let sortedData = baseData.slice().sort(comparator);

    if (viewMode === 'albums' && ['recent', 'newest', 'frequent'].includes(sortOption) && newDirection === 'asc') {
      sortedData = sortedData.slice().reverse();
    }

    const paginatedNewData = sortedData.slice(0, ITEMS_PER_PAGE);

    setSortDirection(newDirection);
    setCurrentPage(0);
    setDisplayedData(paginatedNewData);
    setHasMoreData(sortedData.length > ITEMS_PER_PAGE);

    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    await animateListOpacityTo(1, 280);
    isAnimatingList.current = false;
  }, [sortDirection, sortOption, viewMode, artists, albums, likedSongs, playlists, createSortComparator, animateListOpacityTo]);

  // For the random album sort, the direction toggle is replaced by a refresh
  // action that reshuffles and re-persists the shared random ordering (the reset).
  const refreshRandomAlbums = useCallback(async () => {
    if (isAnimatingList.current) return;
    isAnimatingList.current = true;
    try {
      await animateListOpacityTo(0, 180);
      setDisplayedData([]);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });

      const fresh = await getRandomAlbums(true);
      setAlbums(fresh);
      const paginatedNewData = fresh.slice(0, ITEMS_PER_PAGE);

      setCurrentPage(0);
      setDisplayedData(paginatedNewData);
      setHasMoreData(fresh.length > ITEMS_PER_PAGE);

      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      await animateListOpacityTo(1, 280);
    } catch (error) {
      console.error('Error refreshing random albums:', error);
      await animateListOpacityTo(1, 280);
    } finally {
      isAnimatingList.current = false;
    }
  }, [animateListOpacityTo]);

  // Ref to the full sorted+filtered list so handleItemPress can enqueue all liked songs,
  // not just the currently-displayed page.
  const fullFilteredDataRef = useRef(fullFilteredData);
  useEffect(() => {
    fullFilteredDataRef.current = fullFilteredData;
  }, [fullFilteredData]);

  const handleItemPress = useCallback((item, index) => {
    switch (viewMode) {
      case 'artists':
        navigation.push('Artist', { artist: item });
        break;
      case 'albums':
        navigation.push('Album', { album: item });
        break;
      case 'liked': {
        const fullData = fullFilteredDataRef.current;
        const fullIndex = fullData.findIndex(t => t?.id === item.id);
        AudioPlayer.playTrack(item, fullData, fullIndex >= 0 ? fullIndex : index, {
          contextName: 'Liked Songs',
          contextType: 'liked',
          contextId: 'liked',
        });
        expandPlayerOverlay();
        break;
      }
      case 'playlists':
        navigation.push('Playlist', { playlist: item });
        break;
      default:
        break;
    }
  }, [viewMode, navigation]);

  const handleMenuPress = useCallback((item) => {
    setMenuSong(item);
  }, []);

  const handleLongPressItem = useCallback((item) => {
    if (viewMode === 'liked') setMenuSong(item);
  }, [viewMode]);

  const handleAddLast = useCallback((item) => {
    appendToContextQueue(item);
  }, [appendToContextQueue]);

  const menuOptions = useMemo(() => {
    if (!menuSong) return [];
    return [
      {
        key: 'goToAlbum',
        label: 'Go to album',
        icon: 'album',
        onPress: () => {
          if (menuSong.albumId) navigation.push('Album', {
            album: { id: menuSong.albumId, name: menuSong.album, artist: menuSong.artist, coverArt: menuSong.coverArt },
          });
        },
      },
      {
        key: 'goToArtist',
        label: 'Go to artist',
        icon: 'person',
        onPress: () => {
          if (menuSong.artistId) navigation.push('Artist', { artist: { id: menuSong.artistId, name: menuSong.artist } });
        },
      },
      {
        key: 'addToPlaylist',
        label: 'Add to playlist',
        icon: 'playlist-add',
        onPress: () => setAddToPlaylistSong(menuSong),
      },
      {
        key: 'addNext',
        label: 'Add next in queue',
        icon: 'queue-play-next',
        onPress: () => insertIntoPriorityQueue(menuSong, 0),
      },
      {
        key: 'addLast',
        label: 'Add last in queue',
        icon: 'add-to-queue',
        onPress: () => appendToContextQueue(menuSong),
      },
      {
        key: 'download',
        label: 'Download',
        icon: 'download',
        disabled: true,
        onPress: () => {},
      },
    ];
  }, [menuSong, navigation, insertIntoPriorityQueue, appendToContextQueue]);

  const currentTrackId = currentTrack?.id;
  const primaryColor = theme.colors.primary;

  const renderItem = useCallback(({ item, index }) => {
    const isPlaying = viewMode === 'liked' && currentTrackId === item.id;
    // Only pull collage data when the playlist itself has no cover art id; this
    // keeps collage map churn from forcing every row to re-render.
    const collageData =
      viewMode === 'playlists' && !item.coverArt
        ? playlistCollages[item.id] || null
        : null;
    return (
      <ListItem
        item={item}
        index={index}
        viewMode={viewMode}
        styles={styles}
        primaryColor={primaryColor}
        collageData={collageData}
        isPlaying={isPlaying}
        theme={theme}
        onPress={handleItemPress}
        onMenuPress={handleMenuPress}
        onLongPress={handleLongPressItem}
        onAddLast={handleAddLast}
      />
    );
  }, [viewMode, playlistCollages, styles, primaryColor, theme, currentTrackId, handleItemPress, handleMenuPress, handleLongPressItem, handleAddLast]);

  // Performance optimization: getItemLayout for FlatList
  const getItemLayout = useCallback((data, index) => ({
    length: LIST_ITEM_HEIGHT,
    offset: LIST_ITEM_HEIGHT * index,
    index,
  }), []);

  // No index in the key: fullFilteredData already dedupes on this exact
  // id/name/title fallback, so the base key is unique within a view. Including
  // the index made every key change whenever the list order did (sort change,
  // direction flip), forcing React to unmount and remount every row instead of
  // just reordering them.
  const keyExtractor = useCallback((item, index) => {
    const baseKey = item?.id ?? item?.name ?? item?.title;
    return baseKey ? `${viewMode}-${baseKey}` : `${viewMode}-item-${index}`;
  }, [viewMode]);

  const renderEmptyState = () => {
    // Don't show empty state during transitions
    if (isAnimatingList.current) {
      return null;
    }
    
    const emptyMessages = {
      artists: { text: 'No artists found', icon: 'person' },
      albums: { text: 'No albums found', icon: 'album' },
      liked: { text: 'No liked songs found', icon: 'favorite' },
      playlists: { text: 'No playlists found', icon: 'queue-music' }
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

  const titleAnimatedStyle = {
    opacity: searchReveal.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
    transform: [
      {
        translateY: searchReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        }),
      },
    ],
  };

  const actionAnimatedStyle = {
    opacity: searchReveal.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
    transform: [
      {
        scale: searchReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.86],
        }),
      },
    ],
  };

  const measuredHeaderWidth = Math.max(headerContentWidth, 1);

  const searchOverlayAnimatedStyle = {
    opacity: searchReveal,
    transform: [
      {
        translateX: searchReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [measuredHeaderWidth, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  const chipSectionWrapperAnimatedStyle = {
    height: chipSectionProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, Math.max(chipSectionHeight, CHIP_SECTION_DEFAULT_HEIGHT)],
      extrapolate: 'clamp',
    }),
    marginTop: chipSectionProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 12],
    }),
    opacity: chipSectionProgress,
  };

  const chipSectionContentAnimatedStyle = {
    transform: [
      {
        translateY: chipSectionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-6, 0],
        }),
      },
    ],
    opacity: chipSectionProgress,
  };

  const headerAnimatedStyle = {
    paddingTop: chipSectionProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [12, 16],
      extrapolate: 'clamp',
    }),
    paddingBottom: chipSectionProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [8, 12],
      extrapolate: 'clamp',
    }),
  };

  const sortListHeader = useMemo(() => (
    <View style={styles.sortControlContainer}>
      <TouchableOpacity
        ref={sortTriggerRef}
        style={[styles.sortTrigger, isSortMenuVisible ? styles.sortTriggerActive : null]}
        accessibilityRole="button"
        accessibilityLabel="Change sort order"
        onPress={showSortOptions}
        activeOpacity={0.8}
      >
        <MaterialIcons
          name="sort"
          size={18}
          color={theme.colors.onSurfaceVariant}
          style={styles.sortTriggerIcon}
        />
        <Text style={styles.sortTriggerLabel}>{SORT_OPTION_LABELS[sortOption]}</Text>
      </TouchableOpacity>

      {viewMode === 'albums' && sortOption === 'random' ? (
        <TouchableOpacity
          style={styles.sortDirectionButton}
          onPress={refreshRandomAlbums}
          accessibilityRole="button"
          accessibilityLabel="Shuffle random albums"
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="refresh"
            size={17}
            color={theme.colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.sortDirectionButton}
          onPress={handleSortDirectionToggle}
          accessibilityRole="button"
          accessibilityLabel={sortDirection === 'desc' ? 'Sort ascending' : 'Sort descending'}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={sortDirection === 'desc' ? 'arrow-downward' : 'arrow-upward'}
            size={16}
            color={theme.colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      )}
    </View>
  ), [viewMode, sortOption, sortDirection, showSortOptions, isSortMenuVisible, handleSortDirectionToggle, refreshRandomAlbums, theme]);

  const backgroundArt = useMemo(() => {
    if (currentTrack?.coverArt) {
      return ArtworkCache.getArtworkSource(currentTrack.coverArt, 600, DEFAULT_ART);
    }
    if (currentTrack?.albumId) {
      return ArtworkCache.getArtworkSource(currentTrack.albumId, 600, DEFAULT_ART);
    }
    return DEFAULT_ART;
  }, [currentTrack?.albumId, currentTrack?.coverArt]);

  const renderWithBackdrop = useCallback(
    content => (
      <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
        {content}
      </ScreenBackground>
    ),
    [backgroundArt]
  );

  if (isLoading) {
    return renderWithBackdrop(
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading your library...</Text>
      </View>
    );
  }

  return renderWithBackdrop(
    <View style={styles.container}>
      <AnimatedHeader style={[styles.header, headerAnimatedStyle]}>
        <View style={styles.headerContent} onLayout={handleHeaderLayout}>
          <Animated.View
            style={[styles.headerTitleWrapper, titleAnimatedStyle]}
            pointerEvents={isSearchActive ? 'none' : 'auto'}
          >
            <Text style={styles.headerTitle}>Library</Text>
          </Animated.View>
          <Animated.View
            style={[styles.headerActionWrapper, actionAnimatedStyle]}
            pointerEvents={isSearchActive ? 'none' : 'auto'}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open search"
              style={styles.headerActionTouchable}
              onPress={openSearch}
              activeOpacity={0.7}
            >
              <MaterialIcons name="search" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </Animated.View>
          <Animated.View
            style={[
              styles.searchOverlay,
              { width: measuredHeaderWidth },
              searchOverlayAnimatedStyle,
            ]}
            pointerEvents={isSearchActive ? 'auto' : 'none'}
          >
            <Searchbar
              ref={searchInputRef}
              placeholder={`Search ${viewMode}...`}
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchbar}
              icon="chevron-left"
              onIconPress={closeSearch}
              inputStyle={styles.searchbarInput}
            />
          </Animated.View>
        </View>

        <Animated.View
          style={[styles.chipSectionWrapper, chipSectionWrapperAnimatedStyle]}
          pointerEvents={isSearchActive ? 'none' : 'auto'}
        >
          <Animated.View
            style={chipSectionContentAnimatedStyle}
          >
            <View onLayout={handleChipSectionLayout}>
              <ScrollView
                horizontal
                ref={chipScrollRef}
                showsHorizontalScrollIndicator={false}
                contentInsetAdjustmentBehavior="never"
                style={styles.chipScrollContainer}
                contentContainerStyle={styles.chipContainer}
              >
                {chipDisplayOrder.map(({ key, label }) => {
                  if (!chipAnimations[key]) {
                    chipAnimations[key] = new Animated.Value(0);
                  }
                  if (!chipHighlightAnimations[key]) {
                    chipHighlightAnimations[key] = new Animated.Value(activeChip === key ? 1 : 0);
                  }

                  const translateValue = chipAnimations[key];
                  const highlightValue = chipHighlightAnimations[key];

                  const translateStyle = {
                    transform: [
                      {
                        translateX: translateValue,
                      },
                    ],
                    zIndex: activeChip === key ? 2 : 1,
                  };

                  // Interpolate background color with smoother transition
                  const backgroundColor = highlightValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [theme.colors.surfaceVariant, theme.colors.secondary],
                    extrapolate: 'clamp',
                  });

                  // Interpolate text color with smoother transition
                  const textColor = highlightValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [theme.colors.onSurfaceVariant, theme.colors.onSecondary],
                    extrapolate: 'clamp',
                  });


                  return (
                    <Animated.View
                      key={key}
                      onLayout={handleChipLayout(key)}
                      style={translateStyle}
                    >
                      <AnimatedTouchableOpacity
                        onPress={() => handleViewModePress(key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: activeChip === key }}
                        style={[
                          styles.bubbleChip,
                          { backgroundColor },
                          activeChip === key ? styles.bubbleChipElevated : null
                        ]}
                        activeOpacity={0.8}
                      >
                        <AnimatedText
                          style={[
                            styles.bubbleChipText,
                            { color: textColor }
                          ]}
                        >
                          {label}
                        </AnimatedText>
                      </AnimatedTouchableOpacity>
                    </Animated.View>
                  );
                })}
              </ScrollView>
            </View>
          </Animated.View>
        </Animated.View>
      </AnimatedHeader>
      
      {/* Fixed Sort Control */}
      <View style={styles.sortControlFixed}>
        {sortListHeader}
      </View>
      
      <AnimatedFlatList
        ref={flatListRef}
        data={displayedData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        ListHeaderComponent={null}
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
        style={[styles.libraryList, { opacity: listOpacity }]}
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={200}
        initialNumToRender={20}
        windowSize={10}
        legacyImplementation={false}
        disableVirtualization={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        ListFooterComponent={null}
      />
      <SongMenu
        song={menuSong}
        visible={menuSong !== null}
        onClose={() => setMenuSong(null)}
        options={menuOptions}
      />
      <AddToPlaylistModal
        song={addToPlaylistSong}
        visible={addToPlaylistSong !== null}
        onClose={() => setAddToPlaylistSong(null)}
      />

      {isSortMenuVisible && (
        <View style={styles.sortMenuPortal} pointerEvents="box-none">
          <Pressable style={styles.sortMenuBackdrop} onPress={() => closeSortMenu()} />
          <Animated.View
            style={[
              styles.sortMenuContainer,
              {
                top: sortMenuAnchor?.top ?? 120,
                left: sortMenuAnchor?.left ?? 16,
                opacity: sortMenuAnimation,
                transform: [
                  {
                    translateY: sortMenuAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                  {
                    scale: sortMenuAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {sortOptions.map(option => {
              const isSelected = option.key === sortOption;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.sortMenuItem,
                    isSelected ? styles.sortMenuItemActive : null,
                  ]}
                  onPress={() => handleSortOptionSelect(option.key)}
                  activeOpacity={0.75}
                >
                  <MaterialIcons
                    name={option.icon}
                    size={18}
                    color={isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    style={styles.sortMenuItemIcon}
                  />
                  <Text
                    style={[
                      styles.sortMenuItemLabel,
                      isSelected ? styles.sortMenuItemLabelActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isSelected && (
                    <MaterialIcons
                      name="check"
                      size={18}
                      color={theme.colors.primary}
                      style={styles.sortMenuItemCheck}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </View>
      )}
    </View>
  );
}


