import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface MonthlyTrend {
  month: string;
  payt: number;
  monthly: number;
  total: number;
}

interface CompanyBreakdown {
  name: string;
  payt: number;
  monthly: number;
  total: number;
}

interface BillingChartsProps {
  monthlyTrends: MonthlyTrend[];
  companyBreakdown: CompanyBreakdown[];
  totalPaytRevenue: number;
  totalMonthlyRevenue: number;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function BillingCharts({ monthlyTrends, companyBreakdown, totalPaytRevenue, totalMonthlyRevenue }: BillingChartsProps) {
  const revenueTypeData = [
    { name: "PAYT Revenue", value: totalPaytRevenue },
    { name: "Monthly Revenue", value: totalMonthlyRevenue },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Monthly Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 100).toLocaleString()}`} />
              <Tooltip formatter={(v: number) => `₦${(v / 100).toLocaleString()}`} />
              <Legend />
              <Bar dataKey="payt" name="PAYT" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="monthly" name="Monthly" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={revenueTypeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {revenueTypeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `₦${(v / 100).toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
