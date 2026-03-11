export interface VisualPoint {
  x: number;
  y: number;
}

export interface VisualCaptioned {
  altText: string;
  caption?: string;
}

export interface ArithmeticAnnotationSpec {
  showCarries?: boolean;
}

export interface ArithmeticRowSpec {
  label?: string;
  values: string[];
}

export interface ArithmeticLayoutVisual extends VisualCaptioned {
  type: 'arithmetic-layout';
  layout:
    | 'column-addition'
    | 'column-subtraction'
    | 'column-multiplication'
    | 'short-division'
    | 'place-value-table';
  operands?: string[];
  operator?: '+' | '-' | 'x' | '÷';
  align?: 'right' | 'decimal';
  showOperator?: boolean;
  showAnswerLine?: boolean;
  showAnswer?: boolean;
  answer?: string;
  annotations?: ArithmeticAnnotationSpec;
  columnHeaders?: string[];
  rows?: ArithmeticRowSpec[];
}

export interface ShapeEdgeLabel {
  from: number;
  to: number;
  label: string;
  anchor?: 'start' | 'middle' | 'end';
  offsetX?: number;
  offsetY?: number;
}

export interface ShapeHelperLine {
  from: VisualPoint;
  to: VisualPoint;
  style?: 'solid' | 'dashed';
  label?: string;
}

export interface ShapeVisual extends VisualCaptioned {
  type: 'shape';
  shape:
    | 'triangle'
    | 'right-triangle'
    | 'rectangle'
    | 'square'
    | 'parallelogram'
    | 'isosceles-triangle'
    | 'isosceles-trapezium'
    | 'regular-polygon'
    | 'irregular-polygon'
    | 'compound-l-shape';
  vertices: VisualPoint[];
  edges?: ShapeEdgeLabel[];
  helperLines?: ShapeHelperLine[];
  meta?: {
    notToScale?: boolean;
    polygonSides?: number;
    rightAngleAt?: number[];
  };
}

export interface NumberLineMarker {
  value: number;
  label?: string;
  kind?: 'point' | 'target' | 'open';
}

export interface NumberLineVisual extends VisualCaptioned {
  type: 'number-line';
  min: number;
  max: number;
  step?: number;
  markers: NumberLineMarker[];
}

export interface FractionBarSegment {
  size: number;
  shaded?: boolean;
  label?: string;
}

export interface FractionBarSpec {
  id: string;
  segments: FractionBarSegment[];
  label?: string;
}

export interface FractionBarVisual extends VisualCaptioned {
  type: 'fraction-bar';
  bars: FractionBarSpec[];
}

export interface AngleVisual extends VisualCaptioned {
  type: 'angle-diagram';
  vertex: VisualPoint;
  arms: [VisualPoint, VisualPoint];
  label?: string;
}

export interface CoordinateGridPoint {
  x: number;
  y: number;
  label?: string;
}

export interface CoordinateGridVisual extends VisualCaptioned {
  type: 'coordinate-grid';
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  points?: CoordinateGridPoint[];
}

export interface ChartBarSpec {
  label: string;
  value: number;
}

export interface ChartVisual extends VisualCaptioned {
  type: 'chart';
  chartType: 'bar';
  series: ChartBarSpec[];
}

export type MathsVisual =
  | ArithmeticLayoutVisual
  | ShapeVisual
  | AngleVisual
  | NumberLineVisual
  | FractionBarVisual
  | CoordinateGridVisual
  | ChartVisual;
