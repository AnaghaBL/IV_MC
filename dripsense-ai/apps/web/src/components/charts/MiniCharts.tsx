import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { asNumber } from "../../utils/format";

export interface ChartDatum {
  name: string;
  value: number;
  secondary?: number;
}

export const Sparkline = ({ values }: { values: number[] }) => {
  const data = values.map((value, index) => ({ name: String(index), value }));
  return (
    <ResponsiveContainer width="100%" height={30}>
      <AreaChart data={data}>
        <Area type="monotone" dataKey="value" stroke="#1D6FA4" fill="#EFF6FF" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export const DpmAreaChart = ({ data }: { data: Array<{ timestamp: string; dpm: string | number | null; flow_rate_ml_hr: string | number | null }> }) => (
  <ResponsiveContainer width="100%" height={260}>
    <AreaChart data={data.slice(-80).map((point) => ({ time: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), raw: asNumber(point.dpm), window: asNumber(point.flow_rate_ml_hr) / 1.5 }))}>
      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
      <XAxis dataKey="time" tick={{ fontSize: 12 }} />
      <YAxis tick={{ fontSize: 12 }} />
      <Tooltip />
      <Area type="monotone" dataKey="raw" stroke="#1D6FA4" fill="#EFF6FF" name="Raw DPM" />
      <Area type="monotone" dataKey="window" stroke="#7C3AED" fill="#F5F3FF" name="Window DPM" />
    </AreaChart>
  </ResponsiveContainer>
);

export const LinePanel = ({ data }: { data: ChartDatum[] }) => (
  <ResponsiveContainer width="100%" height={220}>
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
      <YAxis tick={{ fontSize: 12 }} />
      <Tooltip />
      <Line type="monotone" dataKey="value" stroke="#1D6FA4" strokeWidth={2} />
      <Line type="monotone" dataKey="secondary" stroke="#DC2626" strokeWidth={2} />
    </LineChart>
  </ResponsiveContainer>
);

export const BarPanel = ({ data }: { data: ChartDatum[] }) => (
  <ResponsiveContainer width="100%" height={220}>
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
      <YAxis tick={{ fontSize: 12 }} />
      <Tooltip />
      <Bar dataKey="value" fill="#1D6FA4" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

export const DonutPanel = ({ data }: { data: ChartDatum[] }) => {
  const colors = ["#1D6FA4", "#DC2626", "#D97706", "#7C3AED", "#16A34A"];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Tooltip />
        <Pie data={data} innerRadius={58} outerRadius={86} dataKey="value" nameKey="name">
          {data.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};

export const ScatterPanel = ({ data }: { data: ChartDatum[] }) => (
  <ResponsiveContainer width="100%" height={220}>
    <ScatterChart>
      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
      <XAxis dataKey="value" name="DPM" tick={{ fontSize: 12 }} />
      <YAxis dataKey="secondary" name="Consistency" tick={{ fontSize: 12 }} />
      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
      <Scatter data={data} fill="#16A34A" />
    </ScatterChart>
  </ResponsiveContainer>
);
