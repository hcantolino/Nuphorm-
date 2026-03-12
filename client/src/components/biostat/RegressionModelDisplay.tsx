/**
 * Regression Model Display Component
 * Shows coefficients table, diagnostics, and plots
 */

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface RegressionDisplayProps {
  result: {
    modelType: string;
    coefficients: Array<{
      name: string;
      estimate: number;
      stdError: number;
      pValue: number;
      ci: [number, number];
      significant: boolean;
    }>;
    modelStats: Record<string, number | undefined>;
    diagnostics: Record<string, unknown>;
    interpretation: string;
    plotData: {
      fittedVsActual: Array<{ actual: number; fitted: number; residual: number }>;
      residualPlot: Array<{ fitted: number; residual: number }>;
    };
  };
  warnings?: string[];
}

export function RegressionModelDisplay({ result, warnings = [] }: RegressionDisplayProps) {
  return (
    <div className="space-y-6">
      {/* Model Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="capitalize">{result.modelType} Regression Model</CardTitle>
          <CardDescription>{result.interpretation}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Model Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {result.modelStats.rSquared !== undefined && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">R-squared</div>
                <div className="text-lg font-semibold">
                  {(result.modelStats.rSquared as number).toFixed(3)}
                </div>
              </div>
            )}
            {result.modelStats.adjRSquared !== undefined && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">Adj. R²</div>
                <div className="text-lg font-semibold">
                  {(result.modelStats.adjRSquared as number).toFixed(3)}
                </div>
              </div>
            )}
            {result.modelStats.aic !== undefined && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">AIC</div>
                <div className="text-lg font-semibold">
                  {(result.modelStats.aic as number).toFixed(2)}
                </div>
              </div>
            )}
            {result.modelStats.bic !== undefined && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">BIC</div>
                <div className="text-lg font-semibold">
                  {(result.modelStats.bic as number).toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Coefficients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Model Coefficients</CardTitle>
          <CardDescription>
            Estimates with 95% confidence intervals (* p &lt; 0.05)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Variable</th>
                  <th className="text-right py-2 px-3">Estimate</th>
                  <th className="text-right py-2 px-3">Std. Error</th>
                  <th className="text-right py-2 px-3">P-value</th>
                  <th className="text-right py-2 px-3">95% CI</th>
                </tr>
              </thead>
              <tbody>
                {result.coefficients.map((coef, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{coef.name}</td>
                    <td className="text-right py-2 px-3">{coef.estimate.toFixed(4)}</td>
                    <td className="text-right py-2 px-3">{coef.stdError.toFixed(4)}</td>
                    <td className="text-right py-2 px-3">
                      <div className="flex items-center justify-end gap-2">
                        <span>{coef.pValue.toFixed(4)}</span>
                        {coef.significant && (
                          <Badge variant="secondary" className="text-xs">
                            *
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-2 px-3 text-gray-600">
                      [{coef.ci[0].toFixed(3)}, {coef.ci[1].toFixed(3)}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {warnings.map((warning, idx) => (
                <div key={idx}>{warning}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle>Model Diagnostics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {result.diagnostics.multicollinearity ? (
              <div>
                <div className="font-medium mb-2">Variance Inflation Factors (VIF)</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries((result.diagnostics.multicollinearity as Record<string, number>) || {}).map(
                    ([name, vif]) => (
                      <div key={name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{name}</span>
                        <Badge
                          variant={vif < 5 ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {vif.toFixed(2)}
                        </Badge>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Fitted vs Actual Plot */}
      <Card>
        <CardHeader>
          <CardTitle>Fitted vs Actual Values</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart data={result.plotData.fittedVsActual}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fitted" name="Fitted" />
              <YAxis dataKey="actual" name="Actual" />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Legend />
              <Scatter name="Actual vs Fitted" data={result.plotData.fittedVsActual} fill="#8884d8" />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Residual Plot */}
      <Card>
        <CardHeader>
          <CardTitle>Residual Plot</CardTitle>
          <CardDescription>Residuals vs Fitted Values</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart data={result.plotData.residualPlot}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fitted" name="Fitted" />
              <YAxis dataKey="residual" name="Residual" />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Legend />
              <Scatter name="Residuals" data={result.plotData.residualPlot} fill="#82ca9d" />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
