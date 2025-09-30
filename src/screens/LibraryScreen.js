import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Image,
  ImageBackground,
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
import { BlurView } from 'expo-blur';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import CacheService from '../services/CacheService';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import PlaylistCollage from '../components/PlaylistCollage';
import { usePlayer } from '../contexts/PlayerContext';
import { theme } from '../theme/theme';
import { styles } from '../styles/LibraryScreen.styles';

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

const BASE_SORT_OPTIONS = [
  { key: 'recentlyListened', label: 'Recently Listened', icon: 'history' },
  { key: 'recentlyAdded', label: 'Recently Added', icon: 'library-add' },
  { key: 'dateLoved', label: 'Date Loved', icon: 'favorite' },
  { key: 'alphabetical', label: 'Alphabetical', icon: 'sort-by-alpha' },
];

const DEFAULT_SORT_OPTION = 'recentlyListened';
const LIKED_DEFAULT_SORT_OPTION = 'dateLoved';

const SORT_OPTION_LABELS = BASE_SORT_OPTIONS.reduce((acc, option) => {
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

export default function LibraryScreen({ navigation }) {
  const {
    playerState: { currentTrack },
  } = usePlayer();
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playlistCollages, setPlaylistCollages] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('liked'); // 'liked', 'playlists', 'albums', 'artists'
  const [chipDisplayOrder, setChipDisplayOrder] = useState(() => buildChipOrder('liked'));
  const [activeChip, setActiveChip] = useState('liked');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [headerContentWidth, setHeaderContentWidth] = useState(0);
  const [sortOption, setSortOption] = useState(DEFAULT_SORT_OPTION);
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
  
  const chipScrollRef = useRef(null);
  const sortTriggerRef = useRef(null);
  const listOpacity = useRef(new Animated.Value(1)).current;
  const isAnimatingList = useRef(false);
  const hasLoadedInitialData = useRef(false);
  const chipAnimations = useRef({}).current;
  const chipHighlightAnimations = useRef({}).current;
  const previousActiveChipRef = useRef('liked');
  const chipLayoutsRef = useRef({});
  const pendingChipAnimation = useRef(null);
  const searchReveal = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef(null);
  const chipSectionProgress = useRef(new Animated.Value(1)).current;
  const [chipSectionHeight, setChipSectionHeight] = useState(CHIP_SECTION_DEFAULT_HEIGHT);
  const sortMenuAnimation = useRef(new Animated.Value(0)).current;

  const sortComparator = useMemo(() => {
    // Base alphabetical comparator shared across all sort modes.
    const alphabeticalCompare = (a, b) => {
      const aName = getItemDisplayName(a, viewMode).toLowerCase();
      const bName = getItemDisplayName(b, viewMode).toLowerCase();
      return aName.localeCompare(bName, undefined, ALPHABETICAL_COMPARE_OPTIONS);
    };

    // When the user explicitly picks "Alphabetical", short-circuit to the base comparator.
    if (sortOption === 'alphabetical') {
      return alphabeticalCompare;
    }

    if (sortOption === 'recentlyAdded') {
      // Prefer items most recently added to the library
      const dateFields = ['created', 'dateAdded', 'dateCreated', 'updated', 'starred'];
      return (a, b) => {
        const aValue = getFirstAvailableTimestamp(a, dateFields);
        const bValue = getFirstAvailableTimestamp(b, dateFields);

        if (aValue !== bValue) {
          return bValue - aValue;
        }

        return alphabeticalCompare(a, b);
      };
    }

    if (sortOption === 'dateLoved') {
      // Prefer items most recently favorited (starred), fall back to creation timestamp
      const dateFields = ['starred', 'dateLoved', 'dateFavorited', 'created', 'dateAdded'];
      return (a, b) => {
        const aValue = getFirstAvailableTimestamp(a, dateFields);
        const bValue = getFirstAvailableTimestamp(b, dateFields);

        if (aValue !== bValue) {
          return bValue - aValue;
        }

        return alphabeticalCompare(a, b);
      };
    }

    // Default to recently listened
    const dateFields = ['lastPlayed', 'playedDate', 'played', 'recentPlayed', 'created'];
    return (a, b) => {
      const aValue = getFirstAvailableTimestamp(a, dateFields);
      const bValue = getFirstAvailableTimestamp(b, dateFields);

      if (aValue !== bValue) {
        return bValue - aValue;
      }

      const aCount = typeof a?.playCount === 'number' ? a.playCount : (a?.songCount ?? 0);
      const bCount = typeof b?.playCount === 'number' ? b.playCount : (b?.songCount ?? 0);

      if (aCount !== bCount) {
        return bCount - aCount;
      }

      return alphabeticalCompare(a, b);
    };
  }, [sortOption, viewMode]);

  const sortOptions = useMemo(() => {
    if (viewMode === 'liked') {
      return BASE_SORT_OPTIONS;
    }
    return BASE_SORT_OPTIONS.filter(option => option.key !== 'dateLoved');
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

  useEffect(() => {
    if (viewMode === 'liked') {
      setSortOption(prev => (prev === LIKED_DEFAULT_SORT_OPTION ? prev : LIKED_DEFAULT_SORT_OPTION));
      return;
    }

    if (sortOption === LIKED_DEFAULT_SORT_OPTION) {
      setSortOption(DEFAULT_SORT_OPTION);
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
      // Only set loading state if this is the initial load
      if (!hasLoadedInitialData.current) {
        setIsLoading(true);
      }

      // Check cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cachedArtists = CacheService.get('artists');
        const cachedAlbums = CacheService.get('albums');
        const cachedLikedSongs = CacheService.get('likedSongs');
        const cachedPlaylists = CacheService.get('playlists');
        const cachedPlaylistCollages = CacheService.get('playlistCollages');

        if (cachedArtists && cachedAlbums && cachedLikedSongs && cachedPlaylists) {
          setArtists(cachedArtists);
          setAlbums(cachedAlbums);
          setLikedSongs(cachedLikedSongs);
          setPlaylists(cachedPlaylists);
          setPlaylistCollages(cachedPlaylistCollages || {});
          
          setIsLoading(false);
          hasLoadedInitialData.current = true;
          
          if (shouldAnimate) {
            await animateListOpacityTo(1, 400);
          }
          return;
        }
      }

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
      }

      const cachedArtistImages = CacheService.get('artistImages') || {};
      const updatedArtistImages = { ...cachedArtistImages };
      const shouldUseCachedImages = !forceRefresh;

      const enrichedArtists = await Promise.all(
        (allArtists || []).map(async artist => {
          if (!artist || !artist.id) {
            return artist;
          }

          const cachedImage = shouldUseCachedImages ? cachedArtistImages[artist.id] : undefined;
          if (cachedImage !== undefined) {
            return { ...artist, artistImageUrl: cachedImage };
          }

          if (shouldUseCachedImages && typeof artist.artistImageUrl === 'string') {
            updatedArtistImages[artist.id] = artist.artistImageUrl;
            return artist;
          }

          try {
            const imageUrl = await SubsonicAPI.getCoverArtUrl(artist.id);
            if (typeof imageUrl === 'string' && imageUrl.trim()) {
              const trimmed = imageUrl.trim();
              updatedArtistImages[artist.id] = trimmed;
              return { ...artist, artistImageUrl: trimmed };
            }
          } catch (error) {
            console.warn(`Error loading image for artist ${artist.name}:`, error);
          }

          updatedArtistImages[artist.id] = null;
          return { ...artist, artistImageUrl: null };
        })
      );

      CacheService.set('artistImages', updatedArtistImages);
      allArtists = enrichedArtists;
      CacheService.set('artists', allArtists);
      setArtists(allArtists);

      // Load albums from artists
      let allAlbums = CacheService.get('albums');
      if (!allAlbums || forceRefresh) {
        allAlbums = [];
        const artistsToLoad = allArtists.slice(0, 10);
        for (const artist of artistsToLoad) {
          try {
            const artistData = await SubsonicAPI.getArtist(artist.id);
            if (artistData && artistData.album) {
              allAlbums.push(...artistData.album);
            }
          } catch (error) {
            console.error(`Error loading albums for artist ${artist.name}:`, error);
          }
        }
        CacheService.set('albums', allAlbums);
        
        // Load more albums in the background
        if (allArtists.length > 10) {
          loadMoreAlbumsAsync(allArtists.slice(10, 30), allAlbums);
        }
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
          console.error('Error loading liked songs:', error);
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
          console.error('Error loading playlists:', error);
          playlistsData = [];
        }
      }
      setPlaylists(playlistsData);

      // Load cached playlist collages immediately (non-blocking)
      let cachedCollages = CacheService.get('playlistCollages') || {};
      setPlaylistCollages(cachedCollages);
      
      // Asynchronously load missing collages in the background
      if (playlistsData.length > 0) {
        loadPlaylistCollagesAsync(playlistsData, cachedCollages, forceRefresh);
      }

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
  }, [animateListOpacityTo]);

  const loadMoreAlbumsAsync = useCallback(async (additionalArtists, currentAlbums) => {
    try {
      const newAlbums = [...currentAlbums];
      
      for (const artist of additionalArtists) {
        try {
          const artistData = await SubsonicAPI.getArtist(artist.id);
          if (artistData && artistData.album) {
            newAlbums.push(...artistData.album);
          }
        } catch (error) {
          console.error(`Error loading albums for artist ${artist.name}:`, error);
        }
      }
      
      // Update cache and state with additional albums
      CacheService.set('albums', newAlbums);
      setAlbums(newAlbums);
    } catch (error) {
      console.error('Error in loadMoreAlbumsAsync:', error);
    }
  }, []);

  const loadPlaylistCollagesAsync = useCallback(async (playlistsData, cachedCollages, forceRefresh = false) => {
    try {
      const updatedCollages = { ...cachedCollages };
      
      // Find playlists that need collages
      const playlistsNeedingCollages = playlistsData.filter(playlist => 
        playlist.id && (!cachedCollages[playlist.id] || forceRefresh)
      );
      
      if (playlistsNeedingCollages.length === 0) {
        return;
      }
      
      // Wait for interactions to complete before starting background loading
      InteractionManager.runAfterInteractions(() => {
        // Batch collage updates to prevent constant re-renders
        const batchSize = 5;
        let batchIndex = 0;
        
        const loadNextBatch = async () => {
          const batch = playlistsNeedingCollages.slice(batchIndex, batchIndex + batchSize);
          if (batch.length === 0) return;
          
          const batchUpdates = {};
          
          for (const playlist of batch) {
            try {
              const collageData = await SubsonicAPI.generatePlaylistCollage(playlist.id, 50);
              if (collageData) {
                updatedCollages[playlist.id] = collageData;
                batchUpdates[playlist.id] = collageData;
              }
            } catch (error) {
              console.error(`Error generating collage for playlist ${playlist.name}:`, error);
            }
          }
          
          // Only update state if user is not actively scrolling
          if (!isScrollingRef.current && Object.keys(batchUpdates).length > 0) {
            setPlaylistCollages(prev => ({ ...prev, ...batchUpdates }));
            CacheService.set('playlistCollages', updatedCollages);
          }
          
          batchIndex += batchSize;
          
          // Continue loading next batch after a delay
          if (batchIndex < playlistsNeedingCollages.length) {
            setTimeout(loadNextBatch, 300);
          }
        };
        
        loadNextBatch();
      });
    } catch (error) {
      console.error('Error in loadPlaylistCollagesAsync:', error);
    }
  }, []);

  useEffect(() => {
    const initializeAndLoad = async () => {
      // Ensure SubsonicAPI is initialized before loading data
      const isConfigured = await SubsonicAPI.loadConfiguration();
      if (isConfigured) {
        loadLibraryData(false);
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

    const sortedItems = filteredItems.slice().sort(sortComparator);

    return sortedItems;
  }, [albums, artists, viewMode, likedSongs, playlists, searchQuery, sortComparator]);

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
    // Batch state updates together
    const hasMore = paginatedData.length < fullFilteredData.length;
    
    // Use InteractionManager to defer update if actively scrolling
    if (isScrollingRef.current) {
      InteractionManager.runAfterInteractions(() => {
        setDisplayedData(paginatedData);
        setHasMoreData(hasMore);
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

  const runViewModeTransition = useCallback(async (mode) => {
    try {
      // Fade out the library content FIRST
      await animateListOpacityTo(0, 300);
      
      // THEN set view mode while content is hidden to prevent flash
      setViewMode(mode);
      
      // Check if we need to load data
      const dataByView = {
        artists,
        albums,
        liked: likedSongs,
        playlists,
      };
      
      const hasDataForMode = (dataByView[mode] || []).length > 0;
      
      if (!hasDataForMode) {
        // Only reload data if we don't have it cached
        await loadLibraryData(false);
      }
      
      // Reset pagination and clear old data now that we're hidden
      setCurrentPage(0);
      
      // Wait for next render frame to ensure view mode and data are processed
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Force update displayed data after transition
      const dataByViewAfter = {
        artists,
        albums,
        liked: likedSongs,
        playlists,
      };
      const newData = dataByViewAfter[mode] || [];
      const endIndex = ITEMS_PER_PAGE;
      setDisplayedData(newData.slice(0, endIndex));
      
      // Fade in the library once everything is ready
      await animateListOpacityTo(1, 400);
      
    } catch (error) {
      console.error('Error in view mode transition:', error);
      setViewMode(mode);
      await animateListOpacityTo(1, 400);
    } finally {
      isAnimatingList.current = false;
    }
  }, [animateListOpacityTo, loadLibraryData, artists, albums, likedSongs, playlists]);

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
      await animateListOpacityTo(0, 400);
      setSortOption(optionKey);
      setCurrentPage(0);
      await new Promise(resolve => requestAnimationFrame(resolve));
      await animateListOpacityTo(1, 400);
    } catch (error) {
      console.error('Error applying sort option:', error);
      await animateListOpacityTo(1, 400);
    } finally {
      isAnimatingList.current = false;
    }
  }, [animateListOpacityTo, sortOption, closeSortMenu]);

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

  const handleItemPress = useCallback((item, index) => {
    switch (viewMode) {
      case 'artists':
        navigation.navigate('Artist', { artist: item });
        break;
      case 'albums':
        navigation.navigate('Album', { album: item });
        break;
      case 'liked':
        AudioPlayer.playTrack(item, displayedData, index, {
          contextName: 'Liked Songs',
          contextType: 'liked',
          contextId: 'liked',
        });
        expandPlayerOverlay();
        break;
      case 'playlists':
        // TODO: Navigate to playlist screen when implemented
        break;
      default:
        break;
    }
  }, [viewMode, navigation, displayedData]);

  const handleMenuPress = useCallback((item) => {
    // TODO: Implement menu functionality
  }, []);

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  };

  // Optimized list item component with custom comparison function
  const ListItem = memo(({ item, index, viewMode, playlistCollages }) => {
    const handlePress = useCallback(() => {
      handleItemPress(item, index);
    }, [item, index]);

    const handleMenuPressCallback = useCallback(() => {
      handleMenuPress(item);
    }, [item]);

    // Calculate title and subtitle directly (simpler than switch statement)
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
    
    // Optimize image data calculation - avoid recreating objects
    const imageData = useMemo(() => {
      if (viewMode === 'artists') {
        return item?.artistImageUrl || null;
      }
      if (viewMode === 'albums' || viewMode === 'liked') {
        return (item.coverArt && SubsonicAPI.baseUrl) ? SubsonicAPI.getCoverArtUrl(item.coverArt, 200) : null;
      }
      if (viewMode === 'playlists') {
        return playlistCollages[item.id] || null;
      }
      return null;
    }, [viewMode, item.id, item.coverArt, item.artistImageUrl, playlistCollages]);

    const duration = useMemo(() => {
      return item.duration ? formatDuration(item.duration) : '';
    }, [item.duration]);

    const showDuration = viewMode === 'liked' || viewMode === 'albums' || viewMode === 'playlists';
    const showMenu = viewMode === 'liked' || viewMode === 'playlists';
    
    // Memoized image component - only re-render when imageData changes
    const imageComponent = useMemo(() => {
      if (viewMode === 'playlists' && imageData && typeof imageData === 'object' && imageData.type === 'collage') {
        return (
          <PlaylistCollage 
            collageData={imageData} 
            size={56} 
            style={styles.itemImage} 
          />
        );
      }
      
      const imageUrl = typeof imageData === 'string' ? imageData : null;
      return (
        <Image
          source={imageUrl ? { uri: imageUrl } : require('../../assets/default-album.png')}
          style={styles.itemImage}
          defaultSource={require('../../assets/default-album.png')}
        />
      );
    }, [imageData, viewMode]);
    
    return (
      <TouchableOpacity 
        style={styles.flatListItem}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {viewMode === 'liked' && (
          <MaterialIcons
            name="favorite"
            size={16}
            color={theme.colors.primary}
            style={styles.itemLeadingIcon}
          />
        )}
        {imageComponent}
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemSubtitle}>{subtitle}</Text>
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
  }, (prevProps, nextProps) => {
    // Fast path: check if it's the same item
    if (prevProps.item === nextProps.item && 
        prevProps.viewMode === nextProps.viewMode &&
        prevProps.index === nextProps.index) {
      return true;
    }
    
    // Check item identity and core props
    if (prevProps.item.id !== nextProps.item.id ||
        prevProps.viewMode !== nextProps.viewMode ||
        prevProps.index !== nextProps.index) {
      return false;
    }
    
    // Only check playlist collages reference for playlist view mode
    if (prevProps.viewMode === 'playlists') {
      return prevProps.playlistCollages[prevProps.item.id] === nextProps.playlistCollages[nextProps.item.id];
    }
    
    return true;
  });


  const renderItem = useCallback(({ item, index }) => {
    return (
      <ListItem
        item={item}
        index={index}
        viewMode={viewMode}
        playlistCollages={playlistCollages}
      />
    );
  }, [viewMode, playlistCollages]);

  // Performance optimization: getItemLayout for FlatList
  const getItemLayout = useCallback((data, index) => ({
    length: LIST_ITEM_HEIGHT,
    offset: LIST_ITEM_HEIGHT * index,
    index,
  }), []);

  const keyExtractor = useCallback((item, index) => {
    const baseKey = item?.id ?? item?.name ?? item?.title ?? `item-${index}`;
    return `${viewMode}-${baseKey}-${index}`;
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
        style={[
          styles.sortTrigger,
          isSortMenuVisible ? styles.sortTriggerActive : null,
        ]}
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
    </View>
  ), [sortOption, showSortOptions, isSortMenuVisible]);

  const backgroundArt = useMemo(() => {
    if (currentTrack?.coverArt) {
      return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.coverArt, 600) };
    }
    if (currentTrack?.albumId) {
      return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.albumId, 600) };
    }
    return DEFAULT_ART;
  }, [currentTrack?.albumId, currentTrack?.coverArt]);

  const renderWithBackdrop = useCallback(
    content => (
      <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
        <BlurView intensity={65} tint="dark"  style={styles.blurOverlay}>
          {content}
        </BlurView>
      </ImageBackground>
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
      <AnimatedFlatList
        data={displayedData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        ListHeaderComponent={sortListHeader}
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
        ListFooterComponent={isLoadingMore ? (
          <View style={styles.listFooter}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : null}
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


