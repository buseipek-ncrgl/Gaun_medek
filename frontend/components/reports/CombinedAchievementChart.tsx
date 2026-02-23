"use client";

import { useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type LOAchievement, type POAchievement } from "@/lib/api/assessmentApi";

interface CombinedAchievementChartProps {
  loAchievements: LOAchievement[];
  poAchievements: POAchievement[];
  /** Sınav geçme puanı (0-100). Yoksa 60 kullanılır. */
  passingThreshold?: number;
}

export function CombinedAchievementChart({ loAchievements, poAchievements, passingThreshold = 60 }: CombinedAchievementChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  if (loAchievements.length === 0 && poAchievements.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Görüntülenecek veri yok</p>
        </CardContent>
      </Card>
    );
  }

  // Combine LO and PO data - calculate overall average
  const allAchievements = [
    ...loAchievements.map(lo => ({ code: lo.code, başarı: Math.round(lo.achievedPercentage * 100) / 100 })),
    ...poAchievements.map(po => ({ code: po.code, başarı: Math.round(po.achievedPercentage * 100) / 100 }))
  ];

  // Calculate overall average
  const overallAverage = allAchievements.length > 0
    ? allAchievements.reduce((sum, item) => sum + item.başarı, 0) / allAchievements.length
    : 0;

  const chartData = [
    {
      code: "Genel Ortalama",
      başarı: overallAverage,
    }
  ];

  const getColor = (value: number) => {
    return value >= passingThreshold ? "#22c55e" : "#ef4444";
  };

  // Force bar fill colors after render
  useEffect(() => {
    const forceBarColors = () => {
      if (!chartContainerRef.current) return;
      
      const svg = chartContainerRef.current.querySelector('svg');
      if (!svg) return;

      const barGroups = svg.querySelectorAll('.recharts-bar');
      barGroups.forEach((group, groupIndex) => {
        const rects = group.querySelectorAll('rect.recharts-bar-rectangle');
        rects.forEach((rect, index) => {
          if (index < chartData.length) {
            const rectElement = rect as SVGElement;
            const dataPoint = chartData[index];
            const color = getColor(dataPoint.başarı);
            rectElement.setAttribute('fill', color);
            rectElement.setAttribute('fillOpacity', '1');
            rectElement.setAttribute('opacity', '1');
            rectElement.style.setProperty('fill', color, 'important');
            rectElement.style.setProperty('fill-opacity', '1', 'important');
            rectElement.style.setProperty('opacity', '1', 'important');
          }
        });
      });

      // Force legend text colors
      const legendTexts = svg.querySelectorAll('.recharts-legend-item-text, .recharts-legend-wrapper text, .recharts-legend-wrapper tspan');
      legendTexts.forEach((text) => {
        const textElement = text as SVGElement;
        textElement.setAttribute('fill', 'hsl(var(--foreground))');
        textElement.style.setProperty('fill', 'hsl(var(--foreground))', 'important');
        textElement.style.setProperty('color', 'hsl(var(--foreground))', 'important');
      });
    };

    const timeouts = [
      setTimeout(forceBarColors, 100),
      setTimeout(forceBarColors, 300),
      setTimeout(forceBarColors, 500),
    ];

    const observer = new MutationObserver(forceBarColors);
    if (chartContainerRef.current) {
      observer.observe(chartContainerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    return () => {
      timeouts.forEach(clearTimeout);
      observer.disconnect();
    };
  }, [chartData]);

  return (
    <Card className="border border-brand-navy/20 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-modern rounded-xl">
      <CardHeader className="bg-gradient-to-r from-brand-navy to-[#0f3a6b] text-white rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-xl">
          <BarChart3 className="h-5 w-5" />
          Genel Başarı Özeti
        </CardTitle>
        <CardDescription className="text-white/80 text-sm">
          Genel başarı oranı ve ortalama
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div ref={chartContainerRef} className="w-full" style={{ height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="code"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: 'hsl(var(--foreground))' }}
                label={{ value: 'Başarı (%)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--foreground))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)}%`,
                  name === 'başarı' ? 'Başarı' : name,
                ]}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend
                formatter={(value) => (value === 'başarı' ? 'Başarı %' : value)}
                wrapperStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="başarı" name="Başarı" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry.başarı)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#22c55e]"></div>
            <span className="text-muted-foreground">Başarılı (≥{passingThreshold}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#ef4444]"></div>
            <span className="text-muted-foreground">Başarısız (&lt;{passingThreshold}%)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
