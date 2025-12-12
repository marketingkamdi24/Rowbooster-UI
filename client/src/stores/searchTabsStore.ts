import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SearchResponse } from '@shared/schema';

// Processing status types
export interface ProcessingStatusItem {
  articleNumber: string;
  productName: string;
  status: 'pending' | 'searching' | 'browser-rendering' | 'extracting' | 'completed' | 'failed';
  progress: number;
  result: SearchResponse | null;
  statusDetails?: string;
  error?: string;
}

export interface UrlProcessingStatusItem {
  id: string;
  articleNumber: string;
  productName: string;
  status: 'pending' | 'searching' | 'extracting' | 'completed' | 'failed';
  progress: number;
  result: SearchResponse | null;
  error?: string;
  statusDetails?: string;
}

export interface PdfProcessingStatusItem {
  articleNumber: string;
  productName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: SearchResponse;
  error?: string;
}

export interface CustomProcessingStatusItem {
  id: string;
  articleNumber: string;
  productName: string;
  url?: string;
  status: 'pending' | 'searching' | 'extracting' | 'completed' | 'failed';
  progress: number;
  result: SearchResponse | null;
  error?: string;
  statusDetails?: string;
}

// Custom tab Excel product data
export interface CustomExcelProduct {
  id: string;
  articleNumber: string;
  productName: string;
  url?: string;
}

// Custom tab Excel columns detection
export interface CustomExcelColumns {
  hasArtikelnummer: boolean;
  hasProduktname: boolean;
  hasUrl: boolean;
}

// Extraction mode types for Custom tab
export type CustomExtractionMode = 'url' | 'url+pdf';

export interface UrlExtractionProgress {
  status: 'idle' | 'web-scraping' | 'ai-processing' | 'complete';
  progress: number;
  message: string;
}

// File upload data type
export interface FileUploadData {
  ArticleNumber?: string;
  ProductName: string;
  URL?: string;
  url?: string;
  ProductURL?: string;
  productUrl?: string;
  [key: string]: any;
}

interface SearchTabsState {
  // Active tab state
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Input field states
  articleNumber: string;
  setArticleNumber: (value: string) => void;
  productName: string;
  setProductName: (value: string) => void;
  productUrl: string;
  setProductUrl: (value: string) => void;

  // Search settings
  searchEngine: string;
  setSearchEngine: (value: string) => void;
  maxResults: number;
  setMaxResults: (value: number) => void;
  parallelSearches: number;
  setParallelSearches: (value: number) => void;

  // Input mode states
  fileUploadMode: boolean;
  setFileUploadMode: (value: boolean) => void;
  urlInputMode: 'manual' | 'file';
  setUrlInputMode: (value: 'manual' | 'file') => void;
  pdfInputMode: 'manual' | 'file';
  setPdfInputMode: (value: 'manual' | 'file') => void;

  // Feature toggles
  pdfScraperEnabled: boolean;
  setPdfScraperEnabled: (value: boolean) => void;

  // Auto tab - current search result
  currentSearchResult: SearchResponse | null;
  setCurrentSearchResult: (result: SearchResponse | null) => void;

  // Auto tab - manual mode states
  manualModeSearchResult: SearchResponse | null;
  setManualModeSearchResult: (result: SearchResponse | null) => void;
  manualModeAllResults: SearchResponse[];
  setManualModeAllResults: (results: SearchResponse[]) => void;

  // Auto tab - file mode states
  fileModeSearchResult: SearchResponse | null;
  setFileModeSearchResult: (result: SearchResponse | null) => void;
  fileModeAllResults: SearchResponse[];
  setFileModeAllResults: (results: SearchResponse[]) => void;

  // Auto tab - processing status for file mode
  processingStatus: ProcessingStatusItem[];
  setProcessingStatus: (status: ProcessingStatusItem[] | ((prev: ProcessingStatusItem[]) => ProcessingStatusItem[])) => void;

  // URL tab - manual mode states
  urlManualModeResults: SearchResponse | null;
  setUrlManualModeResults: (result: SearchResponse | null) => void;
  urlManualModeProcessingStatus: UrlProcessingStatusItem[];
  setUrlManualModeProcessingStatus: (status: UrlProcessingStatusItem[] | ((prev: UrlProcessingStatusItem[]) => UrlProcessingStatusItem[])) => void;

  // URL tab - file mode states
  urlFileModeResults: SearchResponse | null;
  setUrlFileModeResults: (result: SearchResponse | null) => void;
  urlFileModeProcessingStatus: UrlProcessingStatusItem[];
  setUrlFileModeProcessingStatus: (status: UrlProcessingStatusItem[] | ((prev: UrlProcessingStatusItem[]) => UrlProcessingStatusItem[])) => void;

  // URL tab - extraction progress
  urlExtractionProgress: UrlExtractionProgress;
  setUrlExtractionProgress: (progress: UrlExtractionProgress) => void;

  // PDF tab - manual mode states
  pdfManualModeResults: SearchResponse | null;
  setPdfManualModeResults: (result: SearchResponse | null) => void;

  // PDF tab - file mode states
  pdfFileModeResults: SearchResponse | null;
  setPdfFileModeResults: (result: SearchResponse | null) => void;
  pdfProcessingStatus: PdfProcessingStatusItem[];
  setPdfProcessingStatus: (status: PdfProcessingStatusItem[] | ((prev: PdfProcessingStatusItem[]) => PdfProcessingStatusItem[])) => void;

  // Custom tab states
  customModeResults: SearchResponse | null;
  setCustomModeResults: (result: SearchResponse | null) => void;
  customProcessingStatus: CustomProcessingStatusItem[];
  setCustomProcessingStatus: (status: CustomProcessingStatusItem[] | ((prev: CustomProcessingStatusItem[]) => CustomProcessingStatusItem[])) => void;
  customAllResults: SearchResponse[];
  setCustomAllResults: (results: SearchResponse[] | ((prev: SearchResponse[]) => SearchResponse[])) => void;
  
  // Custom tab persisted state (for tab switching)
  customTabExcelFileName: string;
  setCustomTabExcelFileName: (name: string) => void;
  customTabExcelData: CustomExcelProduct[];
  setCustomTabExcelData: (data: CustomExcelProduct[]) => void;
  customTabExcelColumns: CustomExcelColumns;
  setCustomTabExcelColumns: (columns: CustomExcelColumns) => void;
  customTabExtractionMode: CustomExtractionMode;
  setCustomTabExtractionMode: (mode: CustomExtractionMode) => void;
  customTabPdfFolderName: string;
  setCustomTabPdfFolderName: (name: string) => void;
  customTabPdfCount: number;
  setCustomTabPdfCount: (count: number) => void;
  
  // Stop/Cancel flags for batch processing
  isAutoSearchStopping: boolean;
  setIsAutoSearchStopping: (value: boolean) => void;
  isCustomSearchStopping: boolean;
  setIsCustomSearchStopping: (value: boolean) => void;

  // Table view mode
  tableViewMode: 'list' | 'data';
  setTableViewMode: (mode: 'list' | 'data') => void;

  // Results section expanded state
  resultsExpanded: boolean;
  setResultsExpanded: (expanded: boolean) => void;

  // File upload data (from useFileUpload hook)
  selectedFileName: string;
  setSelectedFileName: (name: string) => void;
  processedData: FileUploadData[];
  setProcessedData: (data: FileUploadData[]) => void;

  // Home page states
  autoSearchResult: SearchResponse | null;
  setAutoSearchResult: (result: SearchResponse | null) => void;
  // Note: manualSearchResult is now shared with manualModeSearchResult
  fileSearchResult: SearchResponse | null;
  setFileSearchResult: (result: SearchResponse | null) => void;
  
  batchPdfResults: SearchResponse[];
  setBatchPdfResults: (results: SearchResponse[] | ((prev: SearchResponse[]) => SearchResponse[])) => void;
  
  hasPerformedAutoSearch: boolean;
  setHasPerformedAutoSearch: (value: boolean) => void;
  hasPerformedManualSearch: boolean;
  setHasPerformedManualSearch: (value: boolean) => void;
  hasPerformedFileSearch: boolean;
  setHasPerformedFileSearch: (value: boolean) => void;
  
  activeSearchTab: string;
  setActiveSearchTab: (tab: string) => void;
  
  currentResultSource: string;
  setCurrentResultSource: (source: string) => void;
  
  allSearchResults: SearchResponse[];
  setAllSearchResults: (results: SearchResponse[] | ((prev: SearchResponse[]) => SearchResponse[])) => void;
  
  isFileUploadMode: boolean;
  setIsFileUploadMode: (value: boolean) => void;
  
  isPdfMode: boolean;
  setIsPdfMode: (value: boolean) => void;
  
  isSearching: boolean;
  setIsSearching: (value: boolean) => void;

  // Reset function for logout
  resetStore: () => void;
}

// Initial state values
const initialState = {
  activeTab: 'auto',
  articleNumber: '',
  productName: '',
  productUrl: '',
  searchEngine: 'google',
  maxResults: 10,
  parallelSearches: 10,
  fileUploadMode: false,
  urlInputMode: 'manual' as const,
  pdfInputMode: 'manual' as const,
  pdfScraperEnabled: true,
  currentSearchResult: null,
  manualModeSearchResult: null,
  manualModeAllResults: [],
  fileModeSearchResult: null,
  fileModeAllResults: [],
  processingStatus: [],
  urlManualModeResults: null,
  urlManualModeProcessingStatus: [],
  urlFileModeResults: null,
  urlFileModeProcessingStatus: [],
  urlExtractionProgress: { status: 'idle' as const, progress: 0, message: '' },
  pdfManualModeResults: null,
  pdfFileModeResults: null,
  pdfProcessingStatus: [],
  customModeResults: null,
  customProcessingStatus: [],
  customAllResults: [],
  customTabExcelFileName: '',
  customTabExcelData: [],
  customTabExcelColumns: { hasArtikelnummer: false, hasProduktname: false, hasUrl: false },
  customTabExtractionMode: 'url' as CustomExtractionMode,
  customTabPdfFolderName: '',
  customTabPdfCount: 0,
  isAutoSearchStopping: false,
  isCustomSearchStopping: false,
  tableViewMode: 'list' as const,
  resultsExpanded: false,
  selectedFileName: '',
  processedData: [],
  // Home page states
  autoSearchResult: null,
  fileSearchResult: null,
  batchPdfResults: [],
  hasPerformedAutoSearch: false,
  hasPerformedManualSearch: false,
  hasPerformedFileSearch: false,
  activeSearchTab: 'auto',
  currentResultSource: '',
  allSearchResults: [],
  isFileUploadMode: false,
  isPdfMode: false,
  isSearching: false,
};

export const useSearchTabsStore = create<SearchTabsState>()(
  persist(
    (set) => ({
      // Initial values
      ...initialState,

      // Active tab setters
      setActiveTab: (tab) => set({ activeTab: tab }),

  // Input field setters
  setArticleNumber: (value) => set({ articleNumber: value }),
  setProductName: (value) => set({ productName: value }),
  setProductUrl: (value) => set({ productUrl: value }),

  // Search settings setters
  setSearchEngine: (value) => set({ searchEngine: value }),
  setMaxResults: (value) => set({ maxResults: value }),
  setParallelSearches: (value) => set({ parallelSearches: value }),

  // Input mode setters
  setFileUploadMode: (value) => set({ fileUploadMode: value }),
  setUrlInputMode: (value) => set({ urlInputMode: value }),
  setPdfInputMode: (value) => set({ pdfInputMode: value }),

  // Feature toggle setters
  setPdfScraperEnabled: (value) => set({ pdfScraperEnabled: value }),

  // Current search result setter
  setCurrentSearchResult: (result) => set({ currentSearchResult: result }),

  // Auto tab - manual mode setters
  setManualModeSearchResult: (result) => set({ manualModeSearchResult: result }),
  setManualModeAllResults: (results) => set({ manualModeAllResults: results }),

  // Auto tab - file mode setters
  setFileModeSearchResult: (result) => set({ fileModeSearchResult: result }),
  setFileModeAllResults: (results) => set({ fileModeAllResults: results }),

  // Processing status setter (supports functional updates)
  setProcessingStatus: (status) => set((state) => ({
    processingStatus: typeof status === 'function' ? status(state.processingStatus) : status
  })),

  // URL tab - manual mode setters
  setUrlManualModeResults: (result) => set({ urlManualModeResults: result }),
  setUrlManualModeProcessingStatus: (status) => set((state) => ({
    urlManualModeProcessingStatus: typeof status === 'function' ? status(state.urlManualModeProcessingStatus) : status
  })),

  // URL tab - file mode setters
  setUrlFileModeResults: (result) => set({ urlFileModeResults: result }),
  setUrlFileModeProcessingStatus: (status) => set((state) => ({
    urlFileModeProcessingStatus: typeof status === 'function' ? status(state.urlFileModeProcessingStatus) : status
  })),

  // URL extraction progress setter
  setUrlExtractionProgress: (progress) => set({ urlExtractionProgress: progress }),

  // PDF tab - manual mode setter
  setPdfManualModeResults: (result) => set({ pdfManualModeResults: result }),

  // PDF tab - file mode setters
  setPdfFileModeResults: (result) => set({ pdfFileModeResults: result }),
  setPdfProcessingStatus: (status) => set((state) => ({
    pdfProcessingStatus: typeof status === 'function' ? status(state.pdfProcessingStatus) : status
  })),

  // Custom tab setters
  setCustomModeResults: (result) => set({ customModeResults: result }),
  setCustomProcessingStatus: (status) => set((state) => ({
    customProcessingStatus: typeof status === 'function' ? status(state.customProcessingStatus) : status
  })),
  setCustomAllResults: (results) => set((state) => ({
    customAllResults: typeof results === 'function' ? results(state.customAllResults) : results
  })),
  
  // Custom tab persisted state setters
  setCustomTabExcelFileName: (name) => set({ customTabExcelFileName: name }),
  setCustomTabExcelData: (data) => set({ customTabExcelData: data }),
  setCustomTabExcelColumns: (columns) => set({ customTabExcelColumns: columns }),
  setCustomTabExtractionMode: (mode) => set({ customTabExtractionMode: mode }),
  setCustomTabPdfFolderName: (name) => set({ customTabPdfFolderName: name }),
  setCustomTabPdfCount: (count) => set({ customTabPdfCount: count }),
  
  // Stop/Cancel flag setters
  setIsAutoSearchStopping: (value) => set({ isAutoSearchStopping: value }),
  setIsCustomSearchStopping: (value) => set({ isCustomSearchStopping: value }),

  // Table view mode setter
  setTableViewMode: (mode) => set({ tableViewMode: mode }),

  // Results expanded setter
  setResultsExpanded: (expanded) => set({ resultsExpanded: expanded }),

  // File upload data setters
  setSelectedFileName: (name) => set({ selectedFileName: name }),
  setProcessedData: (data) => set({ processedData: data }),

  // Home page state setters
  setAutoSearchResult: (result) => set({ autoSearchResult: result }),
  setFileSearchResult: (result) => set({ fileSearchResult: result }),
  
  setBatchPdfResults: (results) => set((state) => ({
    batchPdfResults: typeof results === 'function' ? results(state.batchPdfResults) : results
  })),
  
  setHasPerformedAutoSearch: (value) => set({ hasPerformedAutoSearch: value }),
  setHasPerformedManualSearch: (value) => set({ hasPerformedManualSearch: value }),
  setHasPerformedFileSearch: (value) => set({ hasPerformedFileSearch: value }),
  
  setActiveSearchTab: (tab) => set({ activeSearchTab: tab }),
  setCurrentResultSource: (source) => set({ currentResultSource: source }),
  
  setAllSearchResults: (results) => set((state) => ({
    allSearchResults: typeof results === 'function' ? results(state.allSearchResults) : results
  })),
  
  setIsFileUploadMode: (value) => set({ isFileUploadMode: value }),
  setIsPdfMode: (value) => set({ isPdfMode: value }),
  setIsSearching: (value) => set({ isSearching: value }),

      // Reset store for logout
      resetStore: () => set(initialState),
    }),
    {
      name: 'search-tabs-storage', // unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
      // Only persist the settings that should survive across sessions
      partialize: (state: SearchTabsState) => ({
        maxResults: state.maxResults,
        parallelSearches: state.parallelSearches,
        pdfScraperEnabled: state.pdfScraperEnabled,
        searchEngine: state.searchEngine,
        tableViewMode: state.tableViewMode,
      }),
    }
  )
);