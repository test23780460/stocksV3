import { demoAssets, demoNews } from "../data/fixtures";
import type { MarketDataProvider, NewsProvider } from "./types";

export const demoMarketProvider: MarketDataProvider = {
  async searchAssets(query) {
    const normalized = query.trim().toLowerCase();
    return demoAssets.filter(
      (asset) => asset.symbol.toLowerCase().includes(normalized) || asset.name.toLowerCase().includes(normalized)
    );
  },
  async getQuote(symbol) {
    return demoAssets.find((asset) => asset.symbol.toLowerCase() === symbol.toLowerCase()) ?? null;
  },
  async getBatchQuotes(symbols) {
    const set = new Set(symbols.map((symbol) => symbol.toLowerCase()));
    return demoAssets.filter((asset) => set.has(asset.symbol.toLowerCase()));
  },
  async getHistoricalBars(symbol) {
    return demoAssets.find((asset) => asset.symbol.toLowerCase() === symbol.toLowerCase())?.bars ?? [];
  },
  async getMarketMovers() {
    return [...demoAssets].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 8);
  },
  async getMarketStatus() {
    return "Demo market status: stored fixture snapshot";
  },
  async getCompanyProfile(symbol) {
    return demoAssets.find((asset) => asset.symbol.toLowerCase() === symbol.toLowerCase()) ?? null;
  },
  async getTechnicalData(symbol) {
    const asset = demoAssets.find((item) => item.symbol.toLowerCase() === symbol.toLowerCase());
    if (!asset) {
      const empty: Record<string, number> = {};
      return empty;
    }
    return { rsi: asset.rsi, macd: asset.macd, sma20: asset.sma20, sma50: asset.sma50, sma200: asset.sma200 };
  },
  async getNews(symbol) {
    return demoNews.filter((item) => item.relatedSymbols.includes(symbol));
  },
  async getCryptoQuote(symbol) {
    return demoAssets.find((asset) => asset.type === "crypto" && asset.symbol.toLowerCase() === symbol.toLowerCase()) ?? null;
  },
  async getIndexData(symbol) {
    return demoAssets.find((asset) => asset.type === "index" && asset.symbol.toLowerCase() === symbol.toLowerCase()) ?? null;
  },
  async getETFData(symbol) {
    return demoAssets.find((asset) => asset.type === "etf" && asset.symbol.toLowerCase() === symbol.toLowerCase()) ?? null;
  },
  async getOptionsChain() {
    return [];
  }
};

export const demoNewsProvider: NewsProvider = {
  async getMarketNews() {
    return demoNews;
  },
  async getAssetNews(symbol) {
    return demoNews.filter((item) => item.relatedSymbols.includes(symbol));
  },
  async getNewsByCategory(category) {
    const normalized = category.toLowerCase();
    return demoNews.filter((item) => item.summary.toLowerCase().includes(normalized) || item.headline.toLowerCase().includes(normalized));
  },
  async getTrendingTopics() {
    return ["AI infrastructure", "mega-cap breadth", "crypto liquidity", "rate expectations", "semiconductor volatility"];
  },
  async getSentiment(article) {
    return article.tone;
  },
  async getRelatedAssets(article) {
    return article.relatedSymbols;
  }
};
