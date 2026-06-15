import type { Asset, Bar, NewsItem } from "../types";

export interface MarketDataProvider {
  searchAssets(query: string): Promise<Asset[]>;
  getQuote(symbol: string): Promise<Asset | null>;
  getBatchQuotes(symbols: string[]): Promise<Asset[]>;
  getHistoricalBars(symbol: string, interval: string, startDate: string, endDate: string): Promise<Bar[]>;
  getMarketMovers(): Promise<Asset[]>;
  getMarketStatus(): Promise<string>;
  getCompanyProfile(symbol: string): Promise<Partial<Asset> | null>;
  getTechnicalData(symbol: string): Promise<Record<string, number>>;
  getNews(symbol: string): Promise<NewsItem[]>;
  getCryptoQuote(symbol: string): Promise<Asset | null>;
  getIndexData(symbol: string): Promise<Asset | null>;
  getETFData(symbol: string): Promise<Asset | null>;
  getOptionsChain(symbol: string, expiration?: string): Promise<unknown[]>;
}

export interface NewsProvider {
  getMarketNews(): Promise<NewsItem[]>;
  getAssetNews(symbol: string): Promise<NewsItem[]>;
  getNewsByCategory(category: string): Promise<NewsItem[]>;
  getTrendingTopics(): Promise<string[]>;
  getSentiment(article: NewsItem): Promise<NewsItem["tone"]>;
  getRelatedAssets(article: NewsItem): Promise<string[]>;
}

