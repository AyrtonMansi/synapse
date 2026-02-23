/**
 * Analytics Hooks
 * Custom hooks for analytics functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for managing auto-refresh
 */
export const useAutoRefresh = (
  refreshFn: () => void,
  interval: number = 30000,
  enabled: boolean = true
) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshFn();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshFn]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = setInterval(refresh, interval);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refresh, interval, enabled]);

  return { refresh, isRefreshing };
};

/**
 * Hook for managing time range selection
 */
export const useTimeRange = (defaultRange: string = '24h') => {
  const [timeRange, setTimeRange] = useState(defaultRange);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    let start: number;

    switch (timeRange) {
      case '1h':
        start = now - 60 * 60 * 1000;
        break;
      case '24h':
        start = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        start = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        start = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case '90d':
        start = now - 90 * 24 * 60 * 60 * 1000;
        break;
      case '1y':
        start = now - 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        start = now - 24 * 60 * 60 * 1000;
    }

    setStartTime(start);
    setEndTime(now);
  }, [timeRange]);

  return { timeRange, setTimeRange, startTime, endTime };
};

/**
 * Hook for managing search and filters
 */
export const useSearchFilter = <T extends Record<string, any>>(
  data: T[],
  searchFields: (keyof T)[]
) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filteredData = data.filter((item) => {
    // Search filter
    if (searchQuery) {
      const matchesSearch = searchFields.some((field) => {
        const value = String(item[field]).toLowerCase();
        return value.includes(searchQuery.toLowerCase());
      });
      if (!matchesSearch) return false;
    }

    // Additional filters
    for (const [key, value] of Object.entries(filters)) {
      if (value && String(item[key]) !== value) {
        return false;
      }
    }

    return true;
  });

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearFilters,
    filteredData,
  };
};

/**
 * Hook for pagination
 */
export const usePagination = <T extends any[]>(data: T, itemsPerPage: number = 25) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = data.slice(startIndex, startIndex + itemsPerPage) as T;

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const reset = useCallback(() => {
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    reset();
  }, [data.length, reset]);

  return {
    currentPage,
    totalPages,
    paginatedData,
    goToPage,
    nextPage,
    prevPage,
    reset,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
};

/**
 * Hook for real-time data updates
 */
export const useRealtimeData = <T,>(
  fetchFn: () => Promise<T>,
  interval: number = 30000
) => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await fetchFn();
      setData(result);
      setLastUpdated(Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, interval);
    return () => clearInterval(intervalId);
  }, [fetchData, interval]);

  return { data, isLoading, error, lastUpdated, refetch: fetchData };
};

/**
 * Hook for chart interactions
 */
export const useChartInteractions = () => {
  const [hoveredData, setHoveredData] = useState<any>(null);
  const [selectedData, setSelectedData] = useState<any>(null);
  const [zoomDomain, setZoomDomain] = useState<{ x?: [number, number]; y?: [number, number] } | null>(null);

  const handleMouseMove = useCallback((data: any) => {
    setHoveredData(data);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredData(null);
  }, []);

  const handleClick = useCallback((data: any) => {
    setSelectedData(data);
  }, []);

  const handleZoom = useCallback((domain: { x?: [number, number]; y?: [number, number] }) => {
    setZoomDomain(domain);
  }, []);

  const resetZoom = useCallback(() => {
    setZoomDomain(null);
  }, []);

  return {
    hoveredData,
    selectedData,
    zoomDomain,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
    handleZoom,
    resetZoom,
  };
};
