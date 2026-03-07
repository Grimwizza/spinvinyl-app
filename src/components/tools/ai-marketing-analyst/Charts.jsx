import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { COLORS } from './utils';
import { Icon } from '../../ui/Icon';
import { Card } from '../../ui/Card';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-card border border-border p-3 shadow-md rounded-lg text-card-foreground">
                <p className="font-bold text-sm mb-1">{label || payload[0].name}</p>
                <p className="text-xs text-primary font-semibold mb-1">
                    Revenue: {payload[0].value}
                    {data.unit || (typeof payload[0].value === 'number' && payload[0].value < 100 ? '%' : 'B')}
                </p>
                {data.growth !== undefined && (
                    <p className={`text-[10px] font-bold ${data.growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        YoY Growth: {data.growth > 0 ? '+' : ''}{data.growth}%
                    </p>
                )}
            </div>
        );
    }
    return null;
};

export const MarketShareChart = ({ data }) => {
    if (!data || data.length === 0) return null;
    return (
        <Card className="w-full h-[350px] p-6 mb-8 print:shadow-none print:border-gray-300 print:h-[300px] break-inside-avoid shadow-sm border-border">
            <h4 className="font-bold text-sm text-muted-foreground mb-4 flex items-center gap-2 uppercase tracking-wide">
                <Icon name="pie-chart" size={16} /> Estimated Market Share
            </h4>
            <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        stroke="hsl(var(--card))"
                        strokeWidth={4}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        wrapperStyle={{ fontSize: '12px', fontWeight: '500', color: 'hsl(var(--muted-foreground))' }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </Card>
    );
};

export const SalesChart = ({ data, title, unit }) => {
    if (!data || data.length === 0) return null;

    // Determine label based on unit
    let yAxisLabel = "REVENUE";
    if (unit === 'B') yAxisLabel = "REVENUE (BILLIONS)";
    if (unit === 'M') yAxisLabel = "REVENUE (MILLIONS)";
    if (unit === '%') yAxisLabel = "PERCENTAGE";

    return (
        <Card className="w-full h-[350px] p-6 mb-8 print:shadow-none print:border-gray-300 print:h-[300px] break-inside-avoid shadow-sm border-border">
            <h4 className="font-bold text-sm text-muted-foreground mb-4 flex items-center gap-2 uppercase tracking-wide">
                <Icon name="bar-chart-2" size={16} /> {title || "Annual Sales (Est.)"}
            </h4>
            <ResponsiveContainer width="100%" height="85%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                        dataKey="name"
                        style={{ fontSize: '11px', fontWeight: '500' }}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                    />
                    <YAxis
                        style={{ fontSize: '11px', fontWeight: '500' }}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        dx={-10}
                        label={{ value: yAxisLabel, angle: -90, position: "insideLeft", style: { fontSize: '10px', fontWeight: '600', fill: 'hsl(var(--muted-foreground))', textAnchor: 'middle' }, offset: 0 }}
                    />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.2)' }} content={<CustomTooltip />} />
                    <Bar
                        dataKey="revenue"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </Card>
    );
};
