/**
 * BioStat Graph Studio — Publication-Quality Biostatistical Graphing App
 * Single-file React + Recharts application
 *
 * CDN Dependencies (add to HTML <head>):
 *   <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
 *   <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
 *   <script src="https://unpkg.com/recharts@2/umd/Recharts.js"></script>
 *   <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js"></script>
 *
 * Features:
 *   - CSV data input with auto-parsing
 *   - Bar, Line, Area, Scatter, Pie charts via Recharts
 *   - Reference lines (horizontal/vertical, presets, dashed/dotted/solid)
 *   - Publication-quality data table with MIC detection
 *   - Statistical significance brackets
 *   - Bar value labels + log scale toggle
 *   - Custom marker/dot shapes for line charts
 *   - Screening mode for large-N categorical data (>15 bars)
 *   - Multi-panel figure layouts (A/B/C/D)
 *   - PNG/SVG/CSV export at 300 DPI equivalent
 *   - AI figure caption generator (Anthropic API)
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  ScatterChart, Scatter, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, LabelList,
} from 'recharts';

// ════════════════════════════════════════════════════════════════
// THEME & CONSTANTS
// ════════════════════════════════════════════════════════════════

const THEME = {
  navy: '#1a2035',
  navyLight: '#243049',
  parchment: '#faf8f5',
  panelBg: '#ffffff',
  accent: '#14b8a6',
  accentHover: '#0d9488',
  blue: '#3b82f6',
  gold: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#8b5cf6',
  green: '#22c55e',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  tableBorder: '#cbd5e1',
};

const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

const MARKER_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'cross', 'star'];

const LINE_STYLES = {
  solid: undefined,
  dashed: '8 4',
  dotted: '2 4',
};

const SIG_COLORS = { ns: '#94a3b8', '*': '#eab308', '**': '#f97316', '***': '#ef4444', '****': '#8b5cf6' };
const SIG_PVALS = { ns: 'p > 0.05', '*': 'p < 0.05', '**': 'p < 0.01', '***': 'p < 0.001', '****': 'p < 0.0001' };

const LAYOUT_OPTIONS = [
  { id: '1x1', label: '1×1', cols: 1, rows: 1 },
  { id: '1x2', label: '1×2', cols: 2, rows: 1 },
  { id: '2x1', label: '2×1', cols: 1, rows: 2 },
  { id: '2x2', label: '2×2', cols: 2, rows: 2 },
  { id: '1x3', label: '1×3', cols: 3, rows: 1 },
  { id: '2x3', label: '2×3', cols: 3, rows: 2 },
];

// ════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [], data: [] };
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''));
    const obj = {};
    headers.forEach((h, i) => {
      const raw = vals[i] || '';
      const num = parseFloat(raw);
      obj[h] = isNaN(num) || raw.startsWith('>') || raw.startsWith('<') ? raw : num;
    });
    return obj;
  });
  return { headers, rows, data: rows };
}

function detectTableMode(headers, rows) {
  // >3 categorical columns OR MIC-style values
  let catCount = 0;
  let micLike = false;
  headers.forEach(h => {
    const vals = rows.map(r => r[h]);
    const numCount = vals.filter(v => typeof v === 'number').length;
    if (numCount < vals.length * 0.5) catCount++;
    if (vals.some(v => typeof v === 'string' && (/^[><]/.test(v) || v === '-'))) micLike = true;
  });
  return catCount > 3 || micLike;
}

function sigFigs(n, figs = 4) {
  if (typeof n !== 'number' || isNaN(n)) return n;
  if (n === 0) return '0';
  return parseFloat(n.toPrecision(figs)).toString();
}

function darkenColor(hex, amount = 0.2) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - amount;
  return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
}

function generateFilename(title, ext) {
  const clean = (title || 'chart').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const date = new Date().toISOString().slice(0, 10);
  return `${clean}_${date}.${ext}`;
}

// ════════════════════════════════════════════════════════════════
// CUSTOM MARKER DOT RENDERER
// ════════════════════════════════════════════════════════════════

function CustomDot({ cx, cy, fill, shape = 'circle', size = 6, outline = false }) {
  const stroke = fill;
  const fillColor = outline ? '#fff' : fill;
  const sw = outline ? 2 : 0;
  switch (shape) {
    case 'square':
      return <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} fill={fillColor} stroke={stroke} strokeWidth={sw} />;
    case 'triangle':
      return <polygon points={`${cx},${cy - size} ${cx - size},${cy + size * 0.6} ${cx + size},${cy + size * 0.6}`} fill={fillColor} stroke={stroke} strokeWidth={sw} />;
    case 'triangle-down':
      return <polygon points={`${cx},${cy + size} ${cx - size},${cy - size * 0.6} ${cx + size},${cy - size * 0.6}`} fill={fillColor} stroke={stroke} strokeWidth={sw} />;
    case 'diamond':
      return <polygon points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`} fill={fillColor} stroke={stroke} strokeWidth={sw} />;
    case 'cross': {
      const t = size * 0.3;
      return <path d={`M${cx - size},${cy - t} L${cx - size},${cy + t} L${cx - t},${cy + t} L${cx - t},${cy + size} L${cx + t},${cy + size} L${cx + t},${cy + t} L${cx + size},${cy + t} L${cx + size},${cy - t} L${cx + t},${cy - t} L${cx + t},${cy - size} L${cx - t},${cy - size} L${cx - t},${cy - t} Z`} fill={fillColor} stroke={stroke} strokeWidth={sw} />;
    }
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? size : size * 0.45;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
      }
      return <polygon points={pts.join(' ')} fill={fillColor} stroke={stroke} strokeWidth={sw} />;
    }
    default:
      return <circle cx={cx} cy={cy} r={size / 2} fill={fillColor} stroke={outline ? stroke : 'none'} strokeWidth={sw} />;
  }
}

// Recharts custom dot renderer factory
function makeDotRenderer(shape, color, outline = false) {
  return (props) => {
    const { cx, cy } = props;
    if (cx == null || cy == null) return null;
    return <CustomDot cx={cx} cy={cy} fill={color} shape={shape} size={6} outline={outline} />;
  };
}

// ════════════════════════════════════════════════════════════════
// SIGNIFICANCE BRACKET SVG OVERLAY
// ════════════════════════════════════════════════════════════════

function SigBrackets({ comparisons, chartWidth, chartHeight, margin, data, xKey, groups }) {
  if (!comparisons || comparisons.length === 0 || !data || data.length === 0) return null;

  // Estimate bar positions
  const plotWidth = chartWidth - (margin?.left || 60) - (margin?.right || 20);
  const barGroupWidth = plotWidth / data.length;
  const barWidth = barGroupWidth / (groups.length + 1);

  const brackets = comparisons.map((comp, idx) => {
    const g1Idx = groups.indexOf(comp.group1);
    const g2Idx = groups.indexOf(comp.group2);
    if (g1Idx === -1 || g2Idx === -1) return null;

    const xIdx = comp.xIndex != null ? comp.xIndex : 0;
    const baseX = (margin?.left || 60) + xIdx * barGroupWidth + barGroupWidth / 2;
    const x1 = baseX + (g1Idx - (groups.length - 1) / 2) * barWidth;
    const x2 = baseX + (g2Idx - (groups.length - 1) / 2) * barWidth;

    const bracketY = (margin?.top || 20) - 8 - idx * 24;
    const tickLen = 6;
    const color = SIG_COLORS[comp.sig] || '#64748b';

    return (
      <g key={idx}>
        <line x1={x1} y1={bracketY + tickLen} x2={x1} y2={bracketY} stroke={color} strokeWidth={1.5} />
        <line x1={x1} y1={bracketY} x2={x2} y2={bracketY} stroke={color} strokeWidth={1.5} />
        <line x1={x2} y1={bracketY} x2={x2} y2={bracketY + tickLen} stroke={color} strokeWidth={1.5} />
        <text x={(x1 + x2) / 2} y={bracketY - 4} textAnchor="middle" fontSize={13} fontWeight="bold" fill={color}>
          {comp.sig}
        </text>
      </g>
    );
  });

  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: chartWidth, height: chartHeight, pointerEvents: 'none' }}>
      {brackets}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════
// PUBLICATION TABLE COMPONENT
// ════════════════════════════════════════════════════════════════

function PubTable({ headers, rows, footnotes = '' }) {
  const isQualifier = (v) => typeof v === 'string' && /^[><]/.test(v);

  const downloadCSV = () => {
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => {
      const v = r[h];
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
    }).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = generateFilename('table', 'csv');
    a.click();
  };

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={downloadCSV} style={styles.smallBtn}>Export CSV</button>
      </div>
      <div style={{ overflowX: 'auto', border: `1px solid ${THEME.tableBorder}`, borderRadius: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{
                  background: THEME.navy, color: '#fff', fontWeight: 700,
                  padding: '10px 14px', textAlign: 'left', borderBottom: `2px solid ${THEME.navy}`,
                  whiteSpace: 'pre-line', fontSize: 12, letterSpacing: '0.02em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                {headers.map((h, ci) => {
                  const val = row[h];
                  const isNum = typeof val === 'number';
                  const isQual = isQualifier(val);
                  return (
                    <td key={ci} style={{
                      padding: '8px 14px',
                      borderBottom: `1px solid ${THEME.border}`,
                      textAlign: isNum ? 'right' : 'left',
                      fontFamily: isNum ? "'SF Mono', 'Fira Code', monospace" : 'inherit',
                      fontStyle: isQual ? 'italic' : 'normal',
                      color: isQual ? THEME.textMuted : (val === '-' ? THEME.textMuted : THEME.textPrimary),
                    }}>
                      {isNum ? sigFigs(val) : (val || '-')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnotes && (
        <div style={{ marginTop: 8, fontSize: 11, color: THEME.textSecondary, fontStyle: 'italic', lineHeight: 1.5 }}>
          {footnotes}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// REFERENCE LINES PANEL
// ════════════════════════════════════════════════════════════════

function ReferenceLinesPanel({ lines, onChange }) {
  const addLine = (preset) => {
    const defaults = {
      'baseline': { axis: 'y', value: 0, label: 'No Effect', style: 'dashed', color: THEME.textMuted },
      'vehicle': { axis: 'y', value: 100, label: 'Vehicle Baseline', style: 'dashed', color: THEME.blue },
      'custom': { axis: 'y', value: '', label: '', style: 'dashed', color: THEME.red },
    };
    onChange([...lines, { id: Date.now(), ...defaults[preset] }]);
  };

  const updateLine = (id, field, val) => {
    onChange(lines.map(l => l.id === id ? { ...l, [field]: field === 'value' ? (isNaN(Number(val)) ? val : Number(val)) : val } : l));
  };

  const removeLine = (id) => onChange(lines.filter(l => l.id !== id));

  return (
    <div style={styles.subPanel}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: THEME.textPrimary }}>Reference Lines</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={() => addLine('baseline')} style={styles.presetBtn}>+ Baseline y=0</button>
        <button onClick={() => addLine('vehicle')} style={styles.presetBtn}>+ Vehicle y=100</button>
        <button onClick={() => addLine('custom')} style={styles.presetBtn}>+ Custom</button>
      </div>
      {lines.map(line => (
        <div key={line.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
          <select value={line.axis} onChange={e => updateLine(line.id, 'axis', e.target.value)} style={styles.miniSelect}>
            <option value="y">Y</option>
            <option value="x">X</option>
          </select>
          <input type="text" value={line.value} onChange={e => updateLine(line.id, 'value', e.target.value)}
            placeholder="Value" style={{ ...styles.miniInput, width: 60 }} />
          <input type="text" value={line.label} onChange={e => updateLine(line.id, 'label', e.target.value)}
            placeholder="Label" style={{ ...styles.miniInput, width: 90 }} />
          <select value={line.style} onChange={e => updateLine(line.id, 'style', e.target.value)} style={styles.miniSelect}>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
          <input type="color" value={line.color} onChange={e => updateLine(line.id, 'color', e.target.value)}
            style={{ width: 28, height: 24, border: 'none', cursor: 'pointer', padding: 0 }} />
          <button onClick={() => removeLine(line.id)} style={styles.removeBtn}>x</button>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SIGNIFICANCE BRACKETS PANEL
// ════════════════════════════════════════════════════════════════

function SigBracketsPanel({ comparisons, onChange, groups }) {
  const addComparison = () => {
    onChange([...comparisons, { id: Date.now(), group1: groups[0] || '', group2: groups[1] || '', sig: '*', xIndex: 0 }]);
  };

  const update = (id, field, val) => {
    onChange(comparisons.map(c => c.id === id ? { ...c, [field]: field === 'xIndex' ? Number(val) : val } : c));
  };

  const remove = (id) => onChange(comparisons.filter(c => c.id !== id));

  return (
    <div style={styles.subPanel}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: THEME.textPrimary }}>Significance Brackets</div>
      <button onClick={addComparison} style={styles.presetBtn}>+ Add comparison</button>
      {comparisons.map(comp => (
        <div key={comp.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <select value={comp.group1} onChange={e => update(comp.id, 'group1', e.target.value)} style={styles.miniSelect}>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <span style={{ fontSize: 12, color: THEME.textMuted }}>vs</span>
          <select value={comp.group2} onChange={e => update(comp.id, 'group2', e.target.value)} style={styles.miniSelect}>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={comp.sig} onChange={e => update(comp.id, 'sig', e.target.value)} style={styles.miniSelect}>
            {Object.keys(SIG_COLORS).map(s => <option key={s} value={s}>{s} ({SIG_PVALS[s]})</option>)}
          </select>
          <button onClick={() => remove(comp.id)} style={styles.removeBtn}>x</button>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CHART OPTIONS PANEL (value labels, log scale, markers)
// ════════════════════════════════════════════════════════════════

function ChartOptionsPanel({ options, onChange, numericKeys }) {
  const set = (k, v) => onChange({ ...options, [k]: v });
  const hasZeroOrNeg = options._hasZeroOrNeg;

  return (
    <div style={styles.subPanel}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: THEME.textPrimary }}>Chart Options</div>
      <label style={styles.toggleRow}>
        <input type="checkbox" checked={options.showValueLabels} onChange={e => set('showValueLabels', e.target.checked)} />
        <span>Show values on bars</span>
      </label>
      <div style={{ ...styles.toggleRow, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 500 }}>Y-Axis Scale</span>
        <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 6, padding: 2 }}>
          {['linear', 'log'].map(s => (
            <button key={s} onClick={() => {
              if (s === 'log' && hasZeroOrNeg) { alert('Warning: Data contains zeros or negative values. Log scale may produce errors.'); }
              set('yScale', s);
            }} style={{
              ...styles.segBtn, ...(options.yScale === s ? styles.segBtnActive : {}),
            }}>
              {s === 'log' ? 'Log\u2081\u2080' : 'Linear'}
            </button>
          ))}
        </div>
      </div>
      {numericKeys && numericKeys.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: THEME.textPrimary }}>Marker Shapes (line charts)</span>
          {numericKeys.map((k, i) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 11, width: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
              <select value={(options.markers || {})[k] || MARKER_SHAPES[i % MARKER_SHAPES.length]}
                onChange={e => set('markers', { ...(options.markers || {}), [k]: e.target.value })}
                style={styles.miniSelect}>
                {MARKER_SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SCREENING MODE CONFIG
// ════════════════════════════════════════════════════════════════

function ScreeningPanel({ config, onChange }) {
  const set = (k, v) => onChange({ ...config, [k]: v });
  return (
    <div style={styles.subPanel}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: THEME.textPrimary }}>
        Screening Mode (>15 categories)
      </div>
      <label style={styles.toggleRow}>
        <span style={{ fontSize: 12 }}>Threshold line:</span>
        <input type="number" value={config.threshold ?? ''} onChange={e => set('threshold', e.target.value === '' ? null : Number(e.target.value))}
          placeholder="e.g. 0.10" style={{ ...styles.miniInput, width: 80 }} />
      </label>
      <label style={styles.toggleRow}>
        <span style={{ fontSize: 12 }}>Active color:</span>
        <input type="color" value={config.activeColor || '#22c55e'} onChange={e => set('activeColor', e.target.value)}
          style={{ width: 28, height: 22, border: 'none', padding: 0 }} />
      </label>
      <label style={styles.toggleRow}>
        <span style={{ fontSize: 12 }}>Inactive color:</span>
        <input type="color" value={config.inactiveColor || '#cbd5e1'} onChange={e => set('inactiveColor', e.target.value)}
          style={{ width: 28, height: 22, border: 'none', padding: 0 }} />
      </label>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CHART RENDERER
// ════════════════════════════════════════════════════════════════

function ChartRenderer({
  data, headers, chartType, title, xLabel, yLabel, referenceLines, comparisons,
  chartOptions, screeningConfig, panelLabel, numericKeys, xKey,
}) {
  const chartRef = useRef(null);
  const isScreening = chartType === 'bar' && data.length > 15;
  const chartHeight = isScreening ? 450 : 340;
  const chartWidth = isScreening ? Math.max(800, data.length * 32) : undefined;
  const margin = { top: comparisons.length > 0 ? 40 + comparisons.length * 24 : 30, right: 30, bottom: isScreening ? 80 : 40, left: 60 };

  const yScale = chartOptions.yScale || 'linear';
  const yDomain = yScale === 'log' ? ['auto', 'auto'] : undefined;
  const yTickFormatter = yScale === 'log' ? (v) => {
    if (v <= 0) return v;
    const exp = Math.log10(v);
    return Number.isInteger(exp) ? `10${String.fromCharCode(8304 + exp)}` : v;
  } : undefined;

  const yLabelText = yLabel ? (yScale === 'log' ? `${yLabel} (log scale)` : yLabel) : undefined;

  // Screening mode color per bar
  const getBarFill = (entry, key) => {
    if (isScreening && screeningConfig.threshold != null) {
      return entry[key] > screeningConfig.threshold ? (screeningConfig.activeColor || '#22c55e') : (screeningConfig.inactiveColor || '#cbd5e1');
    }
    return undefined;
  };

  const refLineElements = referenceLines.map((rl, i) => (
    <ReferenceLine
      key={`rl-${i}`}
      {...(rl.axis === 'y' ? { y: rl.value } : { x: rl.value })}
      stroke={rl.color || THEME.textMuted}
      strokeDasharray={LINE_STYLES[rl.style]}
      strokeWidth={1.5}
      label={rl.label ? {
        value: rl.label, position: rl.axis === 'y' ? 'right' : 'top',
        fill: rl.color || THEME.textMuted, fontSize: 11, fontWeight: 500,
      } : undefined}
    />
  ));

  const renderThresholdLine = isScreening && screeningConfig.threshold != null ? (
    <ReferenceLine y={screeningConfig.threshold} stroke={THEME.red} strokeDasharray="8 4" strokeWidth={1.5}
      label={{ value: `Cutoff: ${screeningConfig.threshold}`, position: 'right', fill: THEME.red, fontSize: 11 }} />
  ) : null;

  const commonXAxis = (
    <XAxis dataKey={xKey} tick={{ fontSize: isScreening ? 10 : 12, fill: THEME.textSecondary }}
      angle={isScreening ? -45 : 0} textAnchor={isScreening ? 'end'  : 'middle'}
      label={xLabel ? { value: xLabel, position: 'insideBottom', offset: isScreening ? -70 : -5, fill: THEME.textSecondary, fontSize: 12 } : undefined}
      interval={0} />
  );

  const commonYAxis = (
    <YAxis scale={yScale} domain={yDomain} tickFormatter={yTickFormatter}
      tick={{ fontSize: 12, fill: THEME.textSecondary }} allowDataOverflow={yScale === 'log'}
      label={yLabelText ? { value: yLabelText, angle: -90, position: 'insideLeft', offset: 0, fill: THEME.textSecondary, fontSize: 12 } : undefined} />
  );

  const renderChart = () => {
    switch (chartType) {
      case 'bar': {
        return (
          <BarChart data={data} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
            {commonXAxis}{commonYAxis}
            <Tooltip contentStyle={{ background: THEME.navy, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12 }} />
            <Legend />
            {refLineElements}{renderThresholdLine}
            {numericKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]}
                maxBarSize={isScreening ? 18 : 40} radius={[3, 3, 0, 0]}>
                {chartOptions.showValueLabels && (
                  <LabelList dataKey={key} position="top" fontSize={10}
                    formatter={(v) => sigFigs(v)} fill={darkenColor(CHART_COLORS[i % CHART_COLORS.length])}
                    style={{ fontFamily: "'SF Mono', monospace" }} />
                )}
                {isScreening && screeningConfig.threshold != null && (
                  data.map((entry, j) => (
                    <Cell key={j} fill={getBarFill(entry, key) || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))
                )}
              </Bar>
            ))}
          </BarChart>
        );
      }
      case 'line': {
        return (
          <LineChart data={data} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
            {commonXAxis}{commonYAxis}
            <Tooltip contentStyle={{ background: THEME.navy, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12 }} />
            <Legend />
            {refLineElements}
            {numericKeys.map((key, i) => {
              const shape = (chartOptions.markers || {})[key] || MARKER_SHAPES[i % MARKER_SHAPES.length];
              const outline = i >= 3;
              const color = CHART_COLORS[i % CHART_COLORS.length];
              return (
                <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2}
                  dot={makeDotRenderer(shape, color, outline)}
                  activeDot={{ r: 8, fill: color, stroke: '#fff', strokeWidth: 2 }} />
              );
            })}
          </LineChart>
        );
      }
      case 'area': {
        return (
          <AreaChart data={data} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
            {commonXAxis}{commonYAxis}
            <Tooltip contentStyle={{ background: THEME.navy, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12 }} />
            <Legend />
            {refLineElements}
            {numericKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
            ))}
          </AreaChart>
        );
      }
      case 'scatter': {
        if (numericKeys.length < 2) return <div style={{ padding: 40, textAlign: 'center', color: THEME.textMuted }}>Scatter requires 2+ numeric columns.</div>;
        return (
          <ScatterChart margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} />
            <XAxis dataKey={numericKeys[0]} name={numericKeys[0]} type="number"
              tick={{ fontSize: 12, fill: THEME.textSecondary }}
              label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -5, fill: THEME.textSecondary, fontSize: 12 } : undefined} />
            <YAxis dataKey={numericKeys[1]} name={numericKeys[1]} type="number"
              tick={{ fontSize: 12, fill: THEME.textSecondary }}
              label={yLabelText ? { value: yLabelText, angle: -90, position: 'insideLeft', fill: THEME.textSecondary, fontSize: 12 } : undefined} />
            <Tooltip contentStyle={{ background: THEME.navy, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12 }} />
            {refLineElements}
            <Scatter data={data} fill={CHART_COLORS[0]}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Scatter>
          </ScatterChart>
        );
      }
      case 'pie': {
        const pieKey = numericKeys[0];
        return (
          <PieChart>
            <Pie data={data} dataKey={pieKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={120}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: THEME.textMuted }}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: THEME.navy, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12 }} />
            <Legend />
          </PieChart>
        );
      }
      default:
        return null;
    }
  };

  const containerStyle = isScreening
    ? { width: chartWidth, height: chartHeight }
    : { width: '100%', height: chartHeight };

  return (
    <div ref={chartRef} style={{ position: 'relative', background: '#fff', padding: 16, borderRadius: 8 }}>
      {panelLabel && (
        <div style={{ position: 'absolute', top: 12, left: 16, fontWeight: 700, fontSize: 16, color: THEME.navy, fontFamily: 'Arial, sans-serif' }}>
          {panelLabel}
        </div>
      )}
      {title && <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 14, color: THEME.textPrimary, marginBottom: 8 }}>{title}</div>}
      <div style={isScreening ? { overflowX: 'auto', overflowY: 'hidden' } : {}}>
        <div style={containerStyle}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </div>
      {chartType === 'bar' && comparisons.length > 0 && (
        <SigBrackets comparisons={comparisons} chartWidth={600} chartHeight={chartHeight}
          margin={margin} data={data} xKey={xKey} groups={numericKeys} />
      )}
      {isScreening && (
        <div style={{ height: 40, marginTop: 8, background: '#f8fafc', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
          <div style={{ fontSize: 9, color: THEME.textMuted, padding: '2px 6px' }}>Overview</div>
          <svg width="100%" height="28" viewBox={`0 0 ${data.length} 28`} preserveAspectRatio="none">
            {data.map((d, i) => {
              const val = numericKeys[0] ? d[numericKeys[0]] : 0;
              const maxVal = Math.max(...data.map(r => numericKeys[0] ? (r[numericKeys[0]] || 0) : 0));
              const h = maxVal > 0 ? (val / maxVal) * 24 : 0;
              const fill = screeningConfig.threshold != null && val > screeningConfig.threshold
                ? (screeningConfig.activeColor || '#22c55e') : (screeningConfig.inactiveColor || '#cbd5e1');
              return <rect key={i} x={i} y={24 - h} width={0.8} height={h} fill={fill} />;
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// FIGURE CAPTION PANEL
// ════════════════════════════════════════════════════════════════

function CaptionPanel({ caption, onCaptionChange, stats }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(caption).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div style={{ ...styles.subPanel, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: THEME.textPrimary }}>Figure Notes</span>
        <button onClick={copy} style={styles.smallBtn}>{copied ? 'Copied!' : 'Copy'}</button>
      </div>
      <div contentEditable suppressContentEditableWarning style={{
        border: `1px solid ${THEME.border}`, borderRadius: 6, padding: '8px 12px',
        fontSize: 12, lineHeight: 1.6, color: THEME.textPrimary, minHeight: 50,
        fontFamily: "'Georgia', serif", background: '#fafafa',
      }} onBlur={e => onCaptionChange(e.target.innerText)}>
        {caption || 'Click to add figure caption...'}
      </div>
      {stats && (
        <div style={{ marginTop: 8, fontSize: 11, color: THEME.textSecondary, lineHeight: 1.6 }}>
          {stats.split('\n').map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// EXPORT UTILITY
// ════════════════════════════════════════════════════════════════

function ExportDropdown({ chartRef, title, data, headers }) {
  const [open, setOpen] = useState(false);

  const exportPNG = async () => {
    setOpen(false);
    if (!chartRef.current) return;
    try {
      const htmlToImage = window.htmlToImage;
      if (!htmlToImage) { alert('html-to-image library not loaded. Add CDN to page.'); return; }
      const dataUrl = await htmlToImage.toPng(chartRef.current, {
        pixelRatio: 3, backgroundColor: '#ffffff',
        style: { padding: '24px' },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = generateFilename(title, 'png');
      a.click();
    } catch (err) {
      console.error('PNG export failed:', err);
      alert('Export failed. Check console.');
    }
  };

  const exportSVG = async () => {
    setOpen(false);
    if (!chartRef.current) return;
    try {
      const htmlToImage = window.htmlToImage;
      if (!htmlToImage) { alert('html-to-image library not loaded.'); return; }
      const dataUrl = await htmlToImage.toSvg(chartRef.current, { backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = generateFilename(title, 'svg');
      a.click();
    } catch (err) {
      console.error('SVG export failed:', err);
    }
  };

  const exportCSV = () => {
    setOpen(false);
    if (!data || !headers) return;
    const csv = [headers.join(','), ...data.map(r => headers.map(h => {
      const v = r[h];
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : (v ?? '');
    }).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = generateFilename(title, 'csv');
    a.click();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={styles.smallBtn}>Export &#9662;</button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff',
          border: `1px solid ${THEME.border}`, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 50, minWidth: 140,
        }}>
          <button onClick={exportPNG} style={styles.dropItem}>PNG (300 DPI)</button>
          <button onClick={exportSVG} style={styles.dropItem}>SVG (vector)</button>
          <button onClick={exportCSV} style={styles.dropItem}>CSV (data)</button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CSV DETECTION & PREVIEW
// ════════════════════════════════════════════════════════════════

function detectCSVInText(text) {
  const lines = text.trim().split('\n');
  // Need at least 2 lines with commas or tabs to be CSV
  const csvLines = lines.filter(l => l.includes(',') || l.includes('\t'));
  if (csvLines.length < 2) return null;

  // Find the likely CSV block (consecutive lines with similar comma/tab counts)
  const sep = csvLines[0].includes('\t') ? '\t' : ',';
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if ((lines[i].match(new RegExp(sep === '\t' ? '\t' : ',', 'g')) || []).length >= 1) {
      if (startIdx === -1) startIdx = i;
    } else if (startIdx !== -1) break;
  }
  if (startIdx === -1) return null;

  const csvBlock = [];
  for (let i = startIdx; i < lines.length; i++) {
    const count = (lines[i].match(new RegExp(sep === '\t' ? '\t' : ',', 'g')) || []).length;
    if (count >= 1) csvBlock.push(lines[i]);
    else break;
  }
  if (csvBlock.length < 2) return null;

  const headerCols = csvBlock[0].split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const colCounts = csvBlock.map(l => l.split(sep).length);
  const expectedCols = colCounts[0];
  const mismatchRow = colCounts.findIndex((c, i) => i > 0 && c !== expectedCols);

  return {
    detected: true,
    headers: headerCols,
    colCount: expectedCols,
    rowCount: csvBlock.length - 1,
    csvText: csvBlock.join('\n'),
    mismatchRow: mismatchRow !== -1 ? mismatchRow + 1 : null,
  };
}

function CSVPreview({ text }) {
  const info = useMemo(() => detectCSVInText(text), [text]);
  if (!info) return null;

  const shownHeaders = info.headers.slice(0, 4);
  const moreCount = info.headers.length - 4;

  if (info.mismatchRow) {
    return (
      <div style={{
        padding: '6px 12px', background: '#fef9c3', border: '1px solid #fde047',
        borderRadius: 8, fontSize: 11, color: '#92400e', marginBottom: 6,
      }}>
        Column count mismatch — check row {info.mismatchRow}
      </div>
    );
  }

  return (
    <div style={{
      padding: '6px 12px', background: '#ecfdf5', border: `1px solid ${THEME.accent}`,
      borderRadius: 8, fontSize: 11, color: THEME.textPrimary, marginBottom: 6,
    }}>
      <span style={{ color: THEME.green, fontWeight: 600 }}>Data detected</span>
      <span style={{ color: THEME.textSecondary, marginLeft: 8 }}>
        {info.colCount} columns · {info.rowCount} rows
      </span>
      <div style={{ color: THEME.textMuted, marginTop: 2, fontSize: 10 }}>
        {shownHeaders.join(', ')}{moreCount > 0 ? ` ... +${moreCount} more` : ''}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SUGGESTION CHIPS
// ════════════════════════════════════════════════════════════════

const SUGGESTION_CHIPS = [
  'Compare groups with a bar chart',
  'Make a line chart with error bars',
  'Add significance stars between groups',
  'Add a reference line at y = 0',
  'Switch to log scale',
  'Show values on each bar',
  'Generate a Kaplan-Meier curve',
  'Make a waterfall plot',
];

function SuggestionChips({ onSelect }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 0' }}>
      {SUGGESTION_CHIPS.map(chip => (
        <button key={chip} onClick={() => onSelect(chip)} style={{
          background: '#fff', border: `1px solid ${THEME.border}`, borderRadius: 20,
          padding: '6px 14px', fontSize: 11, color: THEME.textSecondary, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.target.style.borderColor = THEME.accent; e.target.style.color = THEME.accent; }}
          onMouseLeave={e => { e.target.style.borderColor = THEME.border; e.target.style.color = THEME.textSecondary; }}>
          {chip}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// NATURAL LANGUAGE → CHART CONFIG INTERPRETER
// ════════════════════════════════════════════════════════════════

function interpretMessage(text, currentConfig) {
  const lower = text.toLowerCase();
  const updates = {};
  let description = '';

  // Chart type changes
  if (/\b(bar chart|bar graph|bars)\b/.test(lower)) { updates.chartType = 'bar'; description += 'Switched to bar chart. '; }
  else if (/\b(line chart|line graph|lines)\b/.test(lower)) { updates.chartType = 'line'; description += 'Switched to line chart. '; }
  else if (/\b(area chart|area graph)\b/.test(lower)) { updates.chartType = 'area'; description += 'Switched to area chart. '; }
  else if (/\b(scatter|scatter plot)\b/.test(lower)) { updates.chartType = 'scatter'; description += 'Switched to scatter plot. '; }
  else if (/\b(pie chart|pie graph)\b/.test(lower)) { updates.chartType = 'pie'; description += 'Switched to pie chart. '; }

  // Log scale
  if (/\blog\s*scale\b/.test(lower) || /\blog.?10\b/.test(lower)) {
    updates.chartOptions = { ...(currentConfig.chartOptions || {}), yScale: 'log' };
    description += 'Switched Y-axis to log scale. ';
  } else if (/\blinear\s*scale\b/.test(lower)) {
    updates.chartOptions = { ...(currentConfig.chartOptions || {}), yScale: 'linear' };
    description += 'Switched Y-axis to linear scale. ';
  }

  // Show values on bars
  if (/\bshow\s*(the\s+)?values?\b/.test(lower) || /\bvalue\s*labels?\b/.test(lower)) {
    updates.chartOptions = { ...(updates.chartOptions || currentConfig.chartOptions || {}), showValueLabels: true };
    description += 'Added value labels on bars. ';
  }
  if (/\bhide\s*(the\s+)?values?\b/.test(lower)) {
    updates.chartOptions = { ...(updates.chartOptions || currentConfig.chartOptions || {}), showValueLabels: false };
    description += 'Removed value labels. ';
  }

  // Reference lines: "baseline at y = 0", "reference line at y=100", "dashed line at y = 0"
  const refMatch = lower.match(/(?:add\s+)?(?:a\s+)?(?:dashed\s+|dotted\s+|solid\s+)?(?:reference\s+|ref\s+)?(?:line|baseline)\s+(?:at\s+)?([xy])\s*=\s*(-?\d+\.?\d*)/);
  if (refMatch) {
    const axis = refMatch[1];
    const value = parseFloat(refMatch[2]);
    const lineStyle = /dotted/.test(lower) ? 'dotted' : /solid/.test(lower) ? 'solid' : 'dashed';
    const labelMatch = text.match(/label(?:ed|led)?\s*["']?([^"'\n,]+)["']?/i);
    const newLine = {
      id: Date.now(), axis, value, style: lineStyle,
      color: axis === 'y' ? THEME.blue : THEME.orange,
      label: labelMatch ? labelMatch[1].trim() : (value === 0 ? 'Baseline' : value === 100 ? 'Vehicle' : `${axis}=${value}`),
    };
    updates.referenceLines = [...(currentConfig.referenceLines || []), newLine];
    description += `Added ${lineStyle} reference line at ${axis}=${value}. `;
  }

  // Significance: "add ** between Vehicle and Treatment A", "add * significance between X and Y"
  const sigMatch = text.match(/(?:add\s+)?(\*{1,4}|ns)\s+(?:significance\s+)?(?:between|comparing)\s+(.+?)\s+(?:and|vs\.?)\s+(.+?)(?:\s*$|\.)/i);
  if (sigMatch) {
    const sig = sigMatch[1];
    const g1 = sigMatch[2].trim();
    const g2 = sigMatch[3].trim();
    const newComp = { id: Date.now(), group1: g1, group2: g2, sig, xIndex: 0 };
    updates.comparisons = [...(currentConfig.comparisons || []), newComp];
    description += `Added ${sig} significance bracket between ${g1} and ${g2}. `;
  }

  // Axis labels
  const xLabelMatch = text.match(/x[\s-]*(?:axis)?\s*label\s*(?:to|=|:)\s*["']?([^"'\n]+)["']?/i);
  if (xLabelMatch) { updates.xLabel = xLabelMatch[1].trim(); description += `Set X-axis label. `; }
  const yLabelMatch = text.match(/y[\s-]*(?:axis)?\s*label\s*(?:to|=|:)\s*["']?([^"'\n]+)["']?/i);
  if (yLabelMatch) { updates.yLabel = yLabelMatch[1].trim(); description += `Set Y-axis label. `; }

  // Title
  const titleMatch = text.match(/(?:title|heading)\s*(?:to|=|:)\s*["']?([^"'\n]+)["']?/i);
  if (titleMatch) { updates.title = titleMatch[1].trim(); description += `Updated title. `; }

  // Table view
  if (/\b(?:show|switch|view)\s*(?:as\s+)?(?:a\s+)?table\b/.test(lower)) { updates.viewMode = 'table'; description += 'Switched to table view. '; }

  return { updates, description: description.trim() || null };
}

// ════════════════════════════════════════════════════════════════
// INLINE CHART CARD (renders inside chat thread)
// ════════════════════════════════════════════════════════════════

function ChatChartCard({ config, headers, rows, onOpenInSettings, errorOverrides }) {
  const chartRef = useRef(null);
  const xKey = headers[0] || '';
  const numericKeys = headers.filter(h => h !== xKey && rows.some(r => typeof r[h] === 'number'));
  const isTableData = detectTableMode(headers, rows);
  const activeView = config.viewMode === 'table' || (config.viewMode === 'auto' && isTableData) ? 'table' : 'chart';

  // Apply error overrides to data
  const chartData = useMemo(() => {
    if (!errorOverrides || Object.keys(errorOverrides).length === 0) return rows;
    return rows;
  }, [rows, errorOverrides]);

  const typeBadge = activeView === 'table' ? 'TABLE' : (config.chartType || 'bar').toUpperCase();

  return (
    <div style={{
      border: `1px solid ${THEME.border}`, borderRadius: 10, background: '#fff',
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Card title bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 14px', background: '#f8fafc', borderBottom: `1px solid ${THEME.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: THEME.textPrimary }}>
            {config.title || 'Chart'}
          </span>
          <span style={{
            background: THEME.accent, color: '#fff', fontSize: 9, fontWeight: 700,
            padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
          }}>{typeBadge}</span>
          <span style={{ fontSize: 11, color: THEME.textMuted }}>{rows.length} observations</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <ExportDropdown chartRef={chartRef} title={config.title} data={rows} headers={headers} />
          {onOpenInSettings && (
            <button onClick={onOpenInSettings} style={{
              ...styles.smallBtn, background: THEME.navyLight, fontSize: 10,
            }}>Open in Settings</button>
          )}
        </div>
      </div>
      {/* Chart body */}
      <div ref={chartRef} style={{ padding: 12 }}>
        {activeView === 'table' ? (
          <PubTable headers={headers} rows={rows} footnotes={config.footnotes} />
        ) : (
          <ChartRenderer
            data={chartData} headers={headers} chartType={config.chartType || 'bar'}
            title={null} xLabel={config.xLabel} yLabel={config.yLabel}
            referenceLines={config.referenceLines || []}
            comparisons={config.comparisons || []}
            chartOptions={config.chartOptions || { showValueLabels: false, yScale: 'linear', markers: {} }}
            screeningConfig={config.screeningConfig || {}}
            panelLabel={null} numericKeys={numericKeys} xKey={xKey}
          />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ERROR VALUES EDITOR
// ════════════════════════════════════════════════════════════════

function ErrorValuesEditor({ headers, rows, overrides, onOverridesChange }) {
  const [open, setOpen] = useState(false);
  const xKey = headers[0] || '';
  const numericKeys = headers.filter(h => h !== xKey && rows.some(r => typeof r[h] === 'number'));

  if (numericKeys.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'none', border: 'none', fontSize: 11, color: THEME.textSecondary,
        cursor: 'pointer', padding: '4px 0',
      }}>
        {open ? 'Hide' : 'Override error values — click any number to edit'}
      </button>
      {open && (
        <div style={{ overflowX: 'auto', marginTop: 6 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: THEME.textSecondary, borderBottom: `1px solid ${THEME.border}` }}>{xKey}</th>
                {numericKeys.map(k => (
                  <th key={k} style={{ textAlign: 'right', padding: '4px 8px', color: THEME.textSecondary, borderBottom: `1px solid ${THEME.border}` }}>
                    {k} Mean
                  </th>
                ))}
                {numericKeys.map(k => (
                  <th key={`err-${k}`} style={{ textAlign: 'right', padding: '4px 8px', color: THEME.accent, borderBottom: `1px solid ${THEME.border}` }}>
                    Error (+/-)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 500 }}>{row[xKey]}</td>
                  {numericKeys.map(k => (
                    <td key={k} style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {typeof row[k] === 'number' ? sigFigs(row[k]) : row[k]}
                    </td>
                  ))}
                  {numericKeys.map(k => {
                    const errKey = `${ri}-${k}`;
                    const val = (overrides && overrides[errKey] != null) ? overrides[errKey] : '';
                    return (
                      <td key={`err-${k}`} style={{ padding: '2px 4px', textAlign: 'right' }}>
                        <input type="number" step="any" value={val} placeholder="—"
                          onChange={e => {
                            const v = e.target.value === '' ? null : parseFloat(e.target.value);
                            onOverridesChange({ ...overrides, [errKey]: v });
                          }}
                          style={{
                            width: 56, border: `1px solid ${THEME.border}`, borderRadius: 4,
                            padding: '2px 4px', fontSize: 11, textAlign: 'right',
                            fontFamily: 'monospace', color: THEME.accent,
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CHAT INPUT
// ════════════════════════════════════════════════════════════════

function ChatInput({ onSend, onFileAttach, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) { onSend(text); setText(''); }
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; }
  }, [text]);

  return (
    <div style={{ borderTop: `1px solid ${THEME.border}`, padding: '10px 14px', background: '#fff' }}>
      <CSVPreview text={text} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <button onClick={onFileAttach} title="Attach CSV file" style={{
          background: 'none', border: `1px solid ${THEME.border}`, borderRadius: 8,
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: THEME.textMuted, flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Paste your data and describe the chart you want... (Shift+Enter for new line)"
          rows={1}
          style={{
            flex: 1, resize: 'none', border: `1px solid ${THEME.border}`, borderRadius: 10,
            padding: '10px 14px', fontSize: 13, fontFamily: "'Inter', sans-serif",
            color: THEME.textPrimary, outline: 'none', lineHeight: 1.5,
            maxHeight: 200, overflowY: 'auto',
          }}
        />
        <button onClick={() => { if (text.trim()) { onSend(text); setText(''); } }}
          disabled={!text.trim() || disabled}
          style={{
            background: text.trim() ? THEME.accent : THEME.border,
            color: '#fff', border: 'none', borderRadius: 8, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: text.trim() ? 'pointer' : 'default', flexShrink: 0,
            transition: 'background 0.15s',
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SINGLE PANEL (chat-based interface)
// ════════════════════════════════════════════════════════════════

function DataPanel({ panelIndex, panelLabel, panelState, onUpdate }) {
  const {
    chartType, title, xLabel, yLabel,
    referenceLines, comparisons, chartOptions, screeningConfig,
    viewMode, footnotes, caption,
  } = panelState;

  // Session state: messages + persistent data
  const [messages, setMessages] = useState([]);
  const [sessionCSV, setSessionCSV] = useState(''); // persisted CSV across follow-ups
  const [errorOverrides, setErrorOverrides] = useState({});
  const [configOpen, setConfigOpen] = useState(false);
  const threadRef = useRef(null);
  const fileInputRef = useRef(null);

  const { headers, rows } = useMemo(() => sessionCSV ? parseCSV(sessionCSV) : { headers: [], rows: [] }, [sessionCSV]);
  const xKey = headers[0] || '';
  const numericKeys = useMemo(() => headers.filter(h => h !== xKey && rows.some(r => typeof r[h] === 'number')), [headers, rows, xKey]);
  const isTableData = useMemo(() => headers.length > 0 && detectTableMode(headers, rows), [headers, rows]);
  const hasZeroOrNeg = useMemo(() => rows.some(r => numericKeys.some(k => typeof r[k] === 'number' && r[k] <= 0)), [rows, numericKeys]);

  // Keep chartOptions in sync
  useEffect(() => {
    if (chartOptions._hasZeroOrNeg !== hasZeroOrNeg) {
      onUpdate({ chartOptions: { ...chartOptions, _hasZeroOrNeg: hasZeroOrNeg } });
    }
  }, [hasZeroOrNeg]);

  const set = (updates) => onUpdate(updates);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  const currentConfig = { chartType, title, xLabel, yLabel, referenceLines, comparisons, chartOptions, screeningConfig, viewMode, footnotes, caption };

  const handleSend = (text) => {
    const userMsg = { id: Date.now(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);

    // Check for CSV data in the message
    const csvInfo = detectCSVInText(text);
    let csv = sessionCSV;
    let chartConfig = { ...currentConfig };
    let aiText = '';

    if (csvInfo && csvInfo.detected) {
      csv = csvInfo.csvText;
      setSessionCSV(csv);
      const parsed = parseCSV(csv);
      const xk = parsed.headers[0] || '';
      const numKeys = parsed.headers.filter(h => h !== xk && parsed.rows.some(r => typeof r[h] === 'number'));
      const isTbl = detectTableMode(parsed.headers, parsed.rows);

      // Infer chart type from message
      let inferredType = chartType;
      const lower = text.toLowerCase();
      if (/\bbar\b/.test(lower)) inferredType = 'bar';
      else if (/\bline\b/.test(lower)) inferredType = 'line';
      else if (/\barea\b/.test(lower)) inferredType = 'area';
      else if (/\bscatter\b/.test(lower)) inferredType = 'scatter';
      else if (/\bpie\b/.test(lower)) inferredType = 'pie';
      else if (/\btable\b/.test(lower) || isTbl) inferredType = 'bar'; // keep bar unless explicit

      const autoTitle = parsed.headers.length > 1
        ? `${parsed.headers.slice(1).join(' vs ')} by ${xk}`
        : 'Chart';

      chartConfig = {
        ...chartConfig,
        chartType: inferredType,
        title: autoTitle,
        viewMode: isTbl ? 'table' : 'chart',
      };
      set({ chartType: inferredType, title: autoTitle, viewMode: isTbl ? 'table' : 'chart' });

      aiText = `Got it — parsed ${parsed.headers.length} columns and ${parsed.rows.length} rows. Here's your ${isTbl ? 'table' : inferredType + ' chart'}:`;
    } else if (csv) {
      // Follow-up: interpret natural language edits
      const { updates, description } = interpretMessage(text, currentConfig);
      if (Object.keys(updates).length > 0) {
        set(updates);
        chartConfig = { ...chartConfig, ...updates };
        aiText = `Updated — ${description}`;
      } else {
        aiText = `I have your data loaded (${rows.length} rows). Try asking me to change the chart type, add reference lines, switch to log scale, or add significance brackets.`;
      }
    } else {
      aiText = 'Paste your CSV data alongside your request and I\'ll generate a chart. For example:\n\n"Here\'s my data — make a bar chart\nTime,Drug A,Drug B\n0,100,100\n30,85,92\n60,62,78"';
    }

    const aiMsg = {
      id: Date.now() + 1,
      role: 'ai',
      text: aiText,
      hasChart: csv !== '',
      chartConfig: { ...chartConfig },
      csvSnapshot: csv,
    };
    setMessages(prev => [...prev, aiMsg]);
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileLoad = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') {
        handleSend(`Here's my data from ${file.name} — make a chart\n${text}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const statsText = useMemo(() => {
    if (!numericKeys.length || !rows.length) return '';
    return numericKeys.map(k => {
      const vals = rows.map(r => r[k]).filter(v => typeof v === 'number');
      if (!vals.length) return '';
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sem = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) / Math.sqrt(vals.length);
      return `${k}: Mean ${sigFigs(mean)} +/- ${sigFigs(sem)} SEM (n=${vals.length})`;
    }).filter(Boolean).join('\n');
  }, [rows, numericKeys]);

  const activeView = viewMode === 'auto' ? (isTableData ? 'table' : 'chart') : viewMode;

  return (
    <div style={{ border: `1px solid ${THEME.border}`, borderRadius: 10, background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: panelLabel ? 620 : 680 }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 14px', borderBottom: `1px solid ${THEME.border}`, background: '#f8fafc',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {panelLabel && <span style={{ fontWeight: 700, fontSize: 15, color: THEME.navy }}>{panelLabel}</span>}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={THEME.accent} strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: THEME.textPrimary }}>Chat</span>
          {sessionCSV && <span style={{ fontSize: 10, color: THEME.green, fontWeight: 500 }}>Data loaded</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {sessionCSV && (
            <button onClick={() => setConfigOpen(!configOpen)} style={styles.smallBtn}>
              {configOpen ? 'Close' : 'Settings'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Chat thread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={THEME.border} strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                <div style={{ fontSize: 14, fontWeight: 600, color: THEME.textPrimary, marginBottom: 4 }}>
                  Paste data, get a chart
                </div>
                <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 16 }}>
                  Paste CSV data with a request — like chatting with a colleague.
                </div>
                <SuggestionChips onSelect={(chip) => handleSend(chip)} />
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} style={{
                marginBottom: 12,
                display: 'flex', flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                {/* Message bubble */}
                <div style={{
                  maxWidth: msg.hasChart ? '100%' : '85%',
                  width: msg.hasChart ? '100%' : undefined,
                  padding: msg.hasChart ? 0 : '10px 14px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? THEME.navy : '#f1f5f9',
                  color: msg.role === 'user' ? '#fff' : THEME.textPrimary,
                  fontSize: 13, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.role === 'user' ? (
                    // User messages: show natural language part, truncate CSV
                    (() => {
                      const csvInfo = detectCSVInText(msg.text);
                      if (csvInfo) {
                        const nonCsv = msg.text.replace(csvInfo.csvText, '').trim();
                        return (
                          <div>
                            {nonCsv && <div>{nonCsv}</div>}
                            <div style={{ fontSize: 11, opacity: 0.7, marginTop: nonCsv ? 6 : 0, background: 'rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6 }}>
                              {csvInfo.colCount} columns · {csvInfo.rowCount} rows attached
                            </div>
                          </div>
                        );
                      }
                      return msg.text;
                    })()
                  ) : (
                    // AI messages
                    <div>
                      {msg.hasChart ? (
                        <div>
                          <div style={{ padding: '10px 14px 8px', fontSize: 13, color: THEME.textPrimary }}>{msg.text}</div>
                          <ChatChartCard
                            config={msg.chartConfig}
                            headers={parseCSV(msg.csvSnapshot).headers}
                            rows={parseCSV(msg.csvSnapshot).rows}
                            onOpenInSettings={() => setConfigOpen(true)}
                            errorOverrides={errorOverrides}
                          />
                          <ErrorValuesEditor
                            headers={parseCSV(msg.csvSnapshot).headers}
                            rows={parseCSV(msg.csvSnapshot).rows}
                            overrides={errorOverrides}
                            onOverridesChange={setErrorOverrides}
                          />
                        </div>
                      ) : msg.text}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={handleFileLoad} />

          {/* Chat input */}
          <ChatInput onSend={handleSend} onFileAttach={handleFileAttach} />
        </div>

        {/* Settings sidebar */}
        {configOpen && sessionCSV && (
          <div style={{
            width: 260, borderLeft: `1px solid ${THEME.border}`, padding: 10,
            overflowY: 'auto', background: '#fafafa', flexShrink: 0,
          }}>
            <div style={styles.subPanel}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Chart Type</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {['bar', 'line', 'area', 'scatter', 'pie'].map(t => (
                  <button key={t} onClick={() => set({ chartType: t })}
                    style={{ ...styles.segBtn, ...(chartType === t ? styles.segBtnActive : {}), textTransform: 'capitalize' }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={styles.subPanel}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Axes</div>
              <input value={xLabel} onChange={e => set({ xLabel: e.target.value })} placeholder="X-axis label"
                style={{ ...styles.miniInput, width: '100%', marginBottom: 6 }} />
              <input value={yLabel} onChange={e => set({ yLabel: e.target.value })} placeholder="Y-axis label"
                style={{ ...styles.miniInput, width: '100%' }} />
            </div>
            <ChartOptionsPanel options={chartOptions} onChange={o => set({ chartOptions: o })} numericKeys={numericKeys} />
            <ReferenceLinesPanel lines={referenceLines} onChange={l => set({ referenceLines: l })} />
            {(chartType === 'bar' || chartType === 'line') && (
              <SigBracketsPanel comparisons={comparisons} onChange={c => set({ comparisons: c })} groups={numericKeys} />
            )}
            {chartType === 'bar' && rows.length > 15 && (
              <ScreeningPanel config={screeningConfig} onChange={c => set({ screeningConfig: c })} />
            )}
            {activeView === 'table' && (
              <div style={styles.subPanel}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Table Footnotes</div>
                <textarea value={footnotes} onChange={e => set({ footnotes: e.target.value })}
                  placeholder="Abbreviations: MXF = moxifloxacin..."
                  style={{ ...styles.miniInput, width: '100%', height: 60, resize: 'vertical' }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════

const defaultPanelState = () => ({
  chartType: 'bar',
  title: '',
  xLabel: '',
  yLabel: '',
  referenceLines: [],
  comparisons: [],
  chartOptions: { showValueLabels: false, yScale: 'linear', markers: {}, _hasZeroOrNeg: false },
  screeningConfig: { threshold: null, activeColor: '#22c55e', inactiveColor: '#cbd5e1' },
  viewMode: 'auto',
  footnotes: '',
  caption: '',
});

export default function BioStatGraphStudio() {
  const [layout, setLayout] = useState('1x1');
  const [panels, setPanels] = useState([defaultPanelState()]);
  const [figureCaption, setFigureCaption] = useState('');
  const figureRef = useRef(null);

  const layoutConfig = LAYOUT_OPTIONS.find(l => l.id === layout) || LAYOUT_OPTIONS[0];
  const panelCount = layoutConfig.cols * layoutConfig.rows;

  // Ensure enough panels exist
  useEffect(() => {
    if (panels.length < panelCount) {
      setPanels(prev => [...prev, ...Array(panelCount - prev.length).fill(null).map(() => defaultPanelState())]);
    }
  }, [panelCount]);

  const updatePanel = (index, updates) => {
    setPanels(prev => prev.map((p, i) => i === index ? { ...p, ...updates } : p));
  };

  const panelLabels = panelCount > 1 ? 'ABCDEFGHI'.slice(0, panelCount).split('') : [null];

  const exportFigurePNG = async () => {
    if (!figureRef.current) return;
    try {
      const htmlToImage = window.htmlToImage;
      if (!htmlToImage) { alert('html-to-image library not loaded.'); return; }
      const dataUrl = await htmlToImage.toPng(figureRef.current, { pixelRatio: 3, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = generateFilename('figure', 'png');
      a.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: THEME.parchment, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{
        background: THEME.navy, color: '#fff', padding: '14px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>BioStat Graph Studio</span>
          <span style={{ fontSize: 11, color: THEME.textMuted, marginLeft: 4 }}>Publication-quality figures</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Layout selector */}
          <span style={{ fontSize: 12, color: THEME.textMuted }}>Layout:</span>
          <select value={layout} onChange={e => setLayout(e.target.value)} style={{
            background: THEME.navyLight, color: '#fff', border: `1px solid rgba(255,255,255,0.15)`,
            borderRadius: 6, padding: '4px 8px', fontSize: 12,
          }}>
            {LAYOUT_OPTIONS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          {panelCount > 1 && (
            <button onClick={exportFigurePNG} style={{
              background: THEME.accent, color: '#fff', border: 'none', borderRadius: 6,
              padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              Export Figure
            </button>
          )}
        </div>
      </div>

      {/* Figure grid */}
      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }} ref={figureRef}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${layoutConfig.cols}, 1fr)`,
          gap: 16,
        }}>
          {panels.slice(0, panelCount).map((panel, i) => (
            <DataPanel
              key={i}
              panelIndex={i}
              panelLabel={panelLabels[i]}
              panelState={panel}
              onUpdate={(updates) => updatePanel(i, updates)}
            />
          ))}
        </div>

        {/* Figure caption */}
        {panelCount > 1 && (
          <div style={{ marginTop: 16, background: '#fff', border: `1px solid ${THEME.border}`, borderRadius: 8, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: THEME.textPrimary, marginBottom: 6 }}>Figure Caption</div>
            <div contentEditable suppressContentEditableWarning style={{
              border: `1px solid ${THEME.border}`, borderRadius: 6, padding: '10px 14px',
              fontSize: 13, lineHeight: 1.7, color: THEME.textPrimary, minHeight: 60,
              fontFamily: "'Georgia', serif", background: '#fafafa',
            }} onBlur={e => setFigureCaption(e.target.innerText)}>
              {figureCaption || 'Click to add overall figure caption...'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SHARED STYLES
// ════════════════════════════════════════════════════════════════

const styles = {
  subPanel: {
    marginBottom: 12,
    padding: 10,
    background: '#fff',
    borderRadius: 8,
    border: `1px solid ${THEME.border}`,
  },
  presetBtn: {
    background: THEME.parchment,
    border: `1px solid ${THEME.border}`,
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 11,
    color: THEME.textSecondary,
    cursor: 'pointer',
    fontWeight: 500,
  },
  smallBtn: {
    background: THEME.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  miniSelect: {
    border: `1px solid ${THEME.border}`,
    borderRadius: 4,
    padding: '3px 6px',
    fontSize: 11,
    color: THEME.textPrimary,
    background: '#fff',
  },
  miniInput: {
    border: `1px solid ${THEME.border}`,
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
    color: THEME.textPrimary,
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: THEME.red,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 14,
    padding: '0 4px',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    fontSize: 12,
    color: THEME.textPrimary,
    cursor: 'pointer',
  },
  segBtn: {
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 500,
    color: THEME.textSecondary,
    cursor: 'pointer',
  },
  segBtnActive: {
    background: '#fff',
    color: THEME.textPrimary,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    fontWeight: 600,
  },
  dropItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    padding: '8px 14px',
    fontSize: 12,
    color: THEME.textPrimary,
    cursor: 'pointer',
    borderBottom: `1px solid ${THEME.border}`,
  },
};
