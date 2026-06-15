import type { GlossaryTerm } from "../types";

const term = (
  termName: string,
  category: string,
  shortDefinition: string,
  fullDefinition: string,
  beginnerExample: string,
  related: string[],
  formula?: string
): GlossaryTerm => ({
  term: termName,
  category,
  shortDefinition,
  fullDefinition,
  beginnerExample,
  related,
  formula
});

export const glossaryTerms: GlossaryTerm[] = [
  term("Volatility", "Risk", "How much a price tends to move.", "Higher volatility means price can move farther in either direction over a given period.", "A high-volatility stock can look exciting but can also move against the thesis quickly.", ["Risk score", "ATR"]),
  term("Volume", "Market Data", "How many shares or units changed hands.", "Volume measures trading activity during a period and helps confirm whether a move has participation.", "A price move with low volume may be less convincing.", ["Relative volume", "Liquidity"]),
  term("Relative volume", "Market Data", "Current volume compared with normal volume.", "Relative volume divides current volume by average volume for a comparable period.", "A 2.0 relative volume reading means activity is about twice normal.", ["Volume"], "Current volume / Average volume"),
  term("Market capitalization", "Fundamentals", "Company value based on share price and share count.", "Market cap is a rough size measure for public companies.", "Large-cap stocks often move differently from tiny speculative stocks.", ["P/E ratio"], "Share price x Shares outstanding"),
  term("Liquidity", "Risk", "How easily an asset can be entered or exited.", "Liquid markets usually have tighter spreads and more reliable pricing.", "A thinly traded option can have a wide bid/ask spread.", ["Bid", "Ask", "Slippage"]),
  term("Bid", "Market Data", "Highest visible price buyers are offering.", "The bid is one side of the quoted market and can change rapidly.", "If the bid is far below the ask, liquidity may be weak.", ["Ask", "Bid/ask spread"]),
  term("Ask", "Market Data", "Lowest visible price sellers are asking.", "The ask is the other side of the quoted market.", "A high ask with a low bid creates a wide spread.", ["Bid", "Bid/ask spread"]),
  term("Bid/ask spread", "Risk", "Distance between bid and ask.", "Wide spreads can raise transaction cost and uncertainty.", "A $10 bid and $10.50 ask has a $0.50 spread.", ["Liquidity", "Slippage"], "Ask - Bid"),
  term("RSI", "Technical", "Momentum oscillator from 0 to 100.", "RSI estimates whether recent gains or losses are stretched.", "RSI above 70 can mean momentum is strong or stretched.", ["Momentum"]),
  term("MACD", "Technical", "Trend-following momentum indicator.", "MACD compares moving averages to estimate trend changes.", "A rising MACD can support a momentum thesis.", ["EMA", "Moving average"]),
  term("Moving average", "Technical", "Average price across a lookback period.", "Moving averages smooth noisy price movement.", "A price above its 50-day average can suggest an uptrend.", ["SMA", "EMA"]),
  term("SMA", "Technical", "Simple moving average.", "SMA is the arithmetic mean of closing prices over a period.", "A 20-day SMA averages the last 20 closes.", ["Moving average"], "Sum of closes / Number of closes"),
  term("EMA", "Technical", "Exponential moving average.", "EMA gives more weight to recent prices than SMA.", "Short EMAs can respond faster to changes.", ["Moving average"]),
  term("Support", "Technical", "A price area where buyers have previously appeared.", "Support is not guaranteed; it is a reference level for research.", "If support breaks, risk may rise.", ["Resistance"]),
  term("Resistance", "Technical", "A price area where sellers have previously appeared.", "Resistance is a reference level where upside may slow.", "A move through resistance can still fail later.", ["Support"]),
  term("Bullish", "Signal", "Research tone leaning upward.", "Bullish describes a positive interpretation, not a command.", "The scanner may call momentum bullish while still flagging risk.", ["Bearish", "Neutral"]),
  term("Bearish", "Signal", "Research tone leaning downward.", "Bearish describes a negative interpretation, not a command.", "Weak trend and negative news can create a bearish read.", ["Bullish", "Neutral"]),
  term("Neutral", "Signal", "No strong directional read.", "Neutral means evidence is mixed or insufficient.", "A neutral setup may be better watched than acted on.", ["Bullish", "Bearish"]),
  term("Momentum", "Technical", "Strength and persistence of price movement.", "Momentum compares recent movement with earlier movement.", "Strong momentum can fade if volume weakens.", ["RSI", "MACD"]),
  term("Sentiment", "News", "Tone of related news and commentary.", "Sentiment can be positive, negative, neutral, or mixed.", "Positive headlines can still be outweighed by high risk.", ["News impact"]),
  term("Risk score", "Risk", "Scanner estimate of downside and uncertainty.", "The risk score combines volatility, participation, momentum extremes, and sentiment.", "A high risk score asks for extra caution.", ["Safety score", "Volatility"]),
  term("Confidence score", "Signal", "How much evidence supports the scanner read.", "Confidence is not accuracy. It measures evidence strength in the current ruleset.", "A high-confidence prediction can still be wrong.", ["Risk score"]),
  term("Safety score", "Risk", "Inverse-style read of research risk.", "Safety score is easier for beginners but still an estimate.", "A 70 safety score does not remove loss risk.", ["Risk score"]),
  term("Market breadth", "Market Regime", "How many assets participate in a move.", "Healthy breadth means gains are spread across many assets.", "Indexes can rise while breadth is weak.", ["Market regime"]),
  term("Market regime", "Market Regime", "The broader environment for risk.", "A regime can be trending, choppy, defensive, or speculative.", "Signals behave differently in a choppy regime.", ["Market breadth"]),
  term("Fear meter", "Risk", "A simplified stress indicator.", "Fear-style indicators estimate market caution, volatility, and negative participation.", "A high fear reading can mean uncertainty is elevated.", ["Volatility"]),
  term("Index", "Asset Type", "A benchmark basket.", "Indexes track groups of securities and are not companies.", "The S&P 500 is a broad U.S. stock index.", ["ETF"]),
  term("ETF", "Asset Type", "Exchange-traded fund.", "ETFs trade like stocks but usually hold baskets of assets.", "SPY tracks the S&P 500 index.", ["Index"]),
  term("Option", "Options", "A contract tied to an underlying asset.", "Options can be complex and high risk. Data should come from a provider.", "An option can lose value quickly even when the stock moves modestly.", ["Call", "Put"]),
  term("Call", "Options", "Option type that gains from upside under certain conditions.", "A call gives the holder certain rights tied to an underlying and expiration.", "Calls are not simple stock replacements.", ["Put", "Strike"]),
  term("Put", "Options", "Option type often associated with downside protection or bearish exposure.", "A put gives the holder certain rights tied to an underlying and expiration.", "Puts can also lose value due to time decay.", ["Call", "Theta"]),
  term("Strike", "Options", "The contract reference price.", "The strike is the price level used to calculate option value.", "A $100 strike call differs from a $120 strike call.", ["Expiration"]),
  term("Expiration", "Options", "Date the option contract expires.", "Options lose time value as expiration approaches.", "Short expirations can be especially sensitive.", ["Theta"]),
  term("Open interest", "Options", "Number of open option contracts.", "Open interest can help evaluate liquidity but is not a direction signal by itself.", "Low open interest can make pricing less reliable.", ["Liquidity"]),
  term("Implied volatility", "Options", "Market-implied future volatility estimate.", "Implied volatility affects option prices and can rise or fall quickly.", "High implied volatility can make options expensive.", ["Vega"]),
  term("Delta", "Options", "Option sensitivity to underlying price.", "Delta estimates how much an option price changes when the underlying changes by $1.", "Delta is provider data when available, not guessed here.", ["Gamma"]),
  term("Gamma", "Options", "Rate of change of delta.", "Gamma measures how quickly delta changes.", "High gamma can make short-dated options move sharply.", ["Delta"]),
  term("Theta", "Options", "Sensitivity to time passing.", "Theta estimates time decay in option value.", "Theta can hurt long option positions as expiration approaches.", ["Expiration"]),
  term("Vega", "Options", "Sensitivity to implied volatility.", "Vega estimates how much option value changes with implied volatility.", "An option can lose value if implied volatility drops.", ["Implied volatility"]),
  term("Market order", "Execution", "Instruction to transact at available market price.", "Market Signal Deck does not execute market orders.", "The platform can discuss the concept but does not place trades.", ["Limit order"]),
  term("Limit order", "Execution", "Instruction with a chosen price limit.", "Market Signal Deck does not execute limit orders.", "A limit order is an education term here, not an action.", ["Market order"]),
  term("Slippage", "Risk", "Difference between expected and actual transaction price.", "Slippage can occur in fast or illiquid markets.", "Wide spreads can increase slippage risk.", ["Bid/ask spread"]),
  term("Diversification", "Risk", "Spreading exposure across assets.", "Diversification can reduce single-asset risk but cannot remove market risk.", "Owning only one volatile asset can concentrate risk.", ["Drawdown"]),
  term("Drawdown", "Risk", "Decline from a prior peak.", "Drawdown measures how far value falls before recovering.", "A 20% drawdown requires a 25% gain to return to the prior level.", ["Volatility"])
];

export const searchGlossary = (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return glossaryTerms;
  return glossaryTerms.filter(
    (item) =>
      item.term.toLowerCase().includes(normalized) ||
      item.shortDefinition.toLowerCase().includes(normalized) ||
      item.category.toLowerCase().includes(normalized)
  );
};

