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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type POAchievement } from "@/lib/api/assessmentApi";

interface POAchievementBarChartProps {
  achievements: POAchievement[];
}

export function POAchievementBarChart({ achievements }: POAchievementBarChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  if (achievements.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Görüntülenecek veri yok</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = achievements.map((achievement) => ({
    code: achievement.code,
    başarı: Math.round(achievement.achievedPercentage * 100) / 100,
    hedef: 50, // 50 puan eşiği
  }));

  const getColor = (value: number) => {
    // 50 puan eşiği: >=50 yeşil, <50 kırmızı
    if (value >= 50) return "#22c55e"; // green-500
    return "#ef4444"; // red-500
  };

  // Force bar fill colors after render
  useEffect(() => {
    const forceBarColors = () => {
      if (!chartContainerRef.current) return;
      
      const svg = chartContainerRef.current.querySelector('svg');
      if (!svg) return;

      // Find all bar rectangles - look for the first Bar's rectangles
      const rects = Array.from(svg.querySelectorAll('rect.recharts-bar-rectangle'));
      
      // Group by parent (each Bar has its own group)
      const barGroups = svg.querySelectorAll('.recharts-bar');
      if (barGroups.length >= 1) {
        // First bar group is "başarı"
        const basariRects = barGroups[0].querySelectorAll('rect.recharts-bar-rectangle');
        basariRects.forEach((rect, index) => {
          if (index < chartData.length) {
            const rectElement = rect as SVGElement;
            const color = getColor(chartData[index].başarı);
            rectElement.setAttribute('fill', color);
            rectElement.setAttribute('fillOpacity', '1');
            rectElement.setAttribute('opacity', '1');
            rectElement.style.setProperty('fill', color, 'important');
            rectElement.style.setProperty('fill-opacity', '1', 'important');
            rectElement.style.setProperty('opacity', '1', 'important');
          }
        });
      }

      // Force legend text colors
      const legendTexts = svg.querySelectorAll('.recharts-legend-item-text, .recharts-legend-wrapper text, .recharts-legend-wrapper tspan');
      legendTexts.forEach((text) => {
        const textElement = text as SVGElement;
        textElement.setAttribute('fill', 'hsl(var(--foreground))');
        textElement.style.setProperty('fill', 'hsl(var(--foreground))', 'important');
        textElement.style.setProperty('color', 'hsl(var(--foreground))', 'important');
      });
    };

    // Run multiple times to catch all render phases
    const timeouts = [
      setTimeout(forceBarColors, 100),
      setTimeout(forceBarColors, 300),
      setTimeout(forceBarColors, 500),
    ];

    // Also use MutationObserver to catch dynamic updates
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
  }, [chartData, achievements]);

  return (
    <Card className="border-2 border-[#0a294e]/20 dark:border-slate-700">
      <CardHeader>
        <CardTitle className="text-2xl text-[#0a294e] dark:text-foreground">Program Çıktıları (PÇ) Başarı Oranları</CardTitle>
        <CardDescription className="text-base">
          Her program çıktısı için ortalama başarı yüzdesi (ÖÇ'lerden türetilmiş)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={chartContainerRef}>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="code"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
              label={{ value: "Başarı Yüzdesi (%)", angle: -90, position: "insideLeft", fill: "hsl(var(--foreground))" }}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Başarı"]}
              labelFormatter={(label) => `PÇ: ${label}`}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
              }}
              itemStyle={{
                color: "hsl(var(--foreground))",
              }}
              labelStyle={{
                color: "hsl(var(--foreground))",
              }}
            />
            <Legend 
              wrapperStyle={{ 
                color: "hsl(var(--foreground))",
                fill: "hsl(var(--foreground))"
              }}
              iconType="square"
            />
            <Bar 
              dataKey="başarı" 
              name="Başarı Oranı" 
              radius={[8, 8, 0, 0]}
              style={{ fillOpacity: 1, opacity: 1 }}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getColor(entry.başarı)}
                  style={{ fillOpacity: 1, opacity: 1 }}
                />
              ))}
            </Bar>
            <Bar
              dataKey="hedef"
              name="Hedef Eşik (50%)"
              fill="#94a3b8"
              opacity={0.3}
              radius={[8, 8, 0, 0]}
            />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-foreground">Başarılı (≥50%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-foreground">Başarısız (&lt;50%)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

