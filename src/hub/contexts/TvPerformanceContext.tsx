import { createContext, useContext } from 'react';

/** When true, components should reduce visual complexity for TV performance */
const TvPerformanceContext = createContext(false);

export const TvPerformanceProvider = TvPerformanceContext.Provider;
export const useTvPerformance = () => useContext(TvPerformanceContext);
