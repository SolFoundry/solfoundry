import type { FNDRYPriceData, FNDRYPriceHookOptions } from '../types';
export declare function useFNDRYPrice(options?: FNDRYPriceHookOptions): {
    data: FNDRYPriceData | null;
    error: string | null;
    isLoading: boolean;
    isRefreshing: boolean;
    retry: () => Promise<void>;
};
//# sourceMappingURL=useFNDRYPrice.d.ts.map