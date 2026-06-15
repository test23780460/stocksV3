"use client";

import { createChart, type IChartApi, type ISeriesApi, type MouseEventParams } from "lightweight-charts";
import { Maximize2, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { currency, formatDateTime, percent } from "../lib/format";
import type { Asset, Bar } from "../types";

const ranges = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"] as const;
export type ChartRange = (typeof ranges)[number];
type ChartType = "line" | "candlestick";
type PriceSeries = ISeriesApi<"Area"> | ISeriesApi<"Candlestick">;

const sliceBars = (bars: Bar[], range: ChartRange) => {
  const sizes: Record<ChartRange, number> = {
    "1D": 1,
    "5D": 5,
    "1M": 22,
    "3M": 66,
    "6M": 132,
    YTD: 130,
    "1Y": 252,
    "5Y": 260,
    MAX: bars.length
  };
  return bars.slice(-Math.min(sizes[range], bars.length));
};

interface Props {
  asset: Asset;
  advanced: boolean;
  autoColor: boolean;
}

export function MarketChart({ asset, advanced, autoColor }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<PriceSeries | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [range, setRange] = useState<ChartRange>("1Y");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [hover, setHover] = useState<{ price: number; time: string } | null>(null);
  const visibleBars = useMemo(() => sliceBars(asset.bars, range), [asset.bars, range]);
  const start = visibleBars[0];
  const end = visibleBars[visibleBars.length - 1];
  const rangeChange = start && end ? ((end.close - start.close) / start.close) * 100 : 0;
  const chartColor = !autoColor ? "#22d3ee" : rangeChange >= 0 ? "#22c55e" : "#fb7185";

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = createChart(containerRef.current, {
      height: 430,
      layout: {
        background: { color: "transparent" },
        textColor: getComputedStyle(document.documentElement).getPropertyValue("--muted-text").trim() || "#92a4b8"
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.12)" },
        horzLines: { color: "rgba(148, 163, 184, 0.12)" }
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.25)"
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.25)",
        timeVisible: true,
        secondsVisible: false
      },
      crosshair: {
        mode: 1
      },
      handleScale: true,
      handleScroll: true
    });

    const priceSeries =
      chartType === "candlestick"
        ? chart.addCandlestickSeries({
            upColor: "#22c55e",
            downColor: "#fb7185",
            borderVisible: false,
            wickUpColor: "#22c55e",
            wickDownColor: "#fb7185",
            priceFormat: { type: "price", precision: 2, minMove: 0.01 }
          })
        : chart.addAreaSeries({
            lineWidth: 2,
            lineColor: chartColor,
            topColor: "rgba(34, 211, 238, 0.26)",
            bottomColor: "rgba(34, 211, 238, 0.02)",
            priceFormat: { type: "price", precision: 2, minMove: 0.01 }
          });

    const volume = chart.addHistogramSeries({
      color: "rgba(148, 163, 184, 0.22)",
      priceFormat: { type: "volume" },
      priceScaleId: ""
    });

    chartRef.current = chart;
    seriesRef.current = priceSeries;
    volumeRef.current = volume;
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      const point = param.seriesData.get(priceSeries);
      if (point && param.time) {
        const price = "value" in point ? point.value : "close" in point ? point.close : null;
        if (typeof price === "number") setHover({ price, time: String(param.time) });
        else setHover(null);
      } else {
        setHover(null);
      }
    });

    const resize = new ResizeObserver(([entry]) => chart.applyOptions({ width: entry.contentRect.width }));
    resize.observe(containerRef.current);

    return () => {
      resize.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
    };
  }, [chartType, chartColor]);

  useEffect(() => {
    if (chartType === "candlestick") {
      const candleSeries = seriesRef.current as ISeriesApi<"Candlestick"> | null;
      candleSeries?.applyOptions({
        upColor: "#22c55e",
        downColor: "#fb7185",
        wickUpColor: "#22c55e",
        wickDownColor: "#fb7185"
      });
      candleSeries?.setData(
        visibleBars.map((bar) => ({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close
        }))
      );
    } else {
      const lineSeries = seriesRef.current as ISeriesApi<"Area"> | null;
      lineSeries?.applyOptions({
        lineColor: chartColor,
        topColor: rangeChange >= 0 ? "rgba(34, 197, 94, 0.22)" : "rgba(248, 113, 113, 0.22)",
        bottomColor: "rgba(34, 211, 238, 0.02)"
      });
      lineSeries?.setData(visibleBars.map((bar) => ({ time: bar.time, value: bar.close })));
    }

    volumeRef.current?.setData(visibleBars.map((bar) => ({ time: bar.time, value: bar.volume, color: "rgba(148, 163, 184, 0.28)" })));
    chartRef.current?.timeScale().fitContent();
  }, [asset.symbol, visibleBars, chartColor, rangeChange, chartType]);

  const selectedPrice = hover?.price ?? asset.price;

  return (
    <section className="chart-panel" aria-label={`${asset.symbol} price chart`}>
      <div className="chart-head">
        <div>
          <div className="eyebrow">Primary Chart</div>
          <h2>{asset.symbol} research chart</h2>
          <p>
            {start?.time} to {end?.time} | {range} change{" "}
            <span className={rangeChange >= 0 ? "positive" : "negative"}>{percent(rangeChange)}</span>
          </p>
        </div>
        <div className="chart-price">
          <strong>{currency(selectedPrice, 2)}</strong>
          <span>{hover ? `${formatDateTime(`${hover.time}T16:00:00-04:00`, false)}` : "Latest stored price"}</span>
        </div>
      </div>
      <div className="timeframe-row" aria-label="Chart timeframe controls">
        <div className="segmented-control" role="group" aria-label="Chart display type">
          {(["line", "candlestick"] as const).map((type) => (
            <button key={type} className={chartType === type ? "chip active" : "chip"} type="button" onClick={() => setChartType(type)}>
              {type === "line" ? "Line" : "Candles"}
            </button>
          ))}
        </div>
        {ranges.map((item) => (
          <button key={item} className={range === item ? "chip active" : "chip"} type="button" onClick={() => setRange(item)}>
            {item}
          </button>
        ))}
        <button className="icon-action" type="button" onClick={() => chartRef.current?.timeScale().fitContent()} aria-label="Reset chart">
          <RotateCcw size={16} />
        </button>
        <button className="icon-action" type="button" onClick={() => containerRef.current?.requestFullscreen?.()} aria-label="Fullscreen chart">
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="chart-meta">
        <span>Last updated {formatDateTime(asset.meta.lastUpdated)}</span>
        <span>{asset.meta.marketStatus}</span>
        <span>{asset.meta.dataStatus}</span>
        <span>Provider: {asset.meta.provider}</span>
      </div>
      <div ref={containerRef} className="chart-canvas" />
      {advanced ? (
        <div className="indicator-strip" aria-label="Advanced chart indicators">
          <span>SMA 20 {currency(asset.sma20)}</span>
          <span>SMA 50 {currency(asset.sma50)}</span>
          <span>SMA 200 {currency(asset.sma200)}</span>
          <span>RSI {asset.rsi}</span>
          <span>MACD {asset.macd}</span>
          <span>Support {currency(asset.support)}</span>
          <span>Resistance {currency(asset.resistance)}</span>
        </div>
      ) : null}
    </section>
  );
}
