import type { ArithmeticLayoutVisual } from '@/lib/maths/visuals/types';
import { mathsVisualTheme } from '@/lib/maths/visuals/theme';

function splitDigits(value: string) {
  return value.replace(/\s+/g, '').split('');
}

function renderPlaceValueTable(visual: ArithmeticLayoutVisual) {
  const headers = visual.columnHeaders ?? [];
  const rows = visual.rows ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full border-collapse text-center text-sm text-slate-800">
        <thead className="bg-slate-50">
          <tr>
            {rows.some((row) => row.label) ? <th className="border border-slate-200 px-3 py-2 text-left">Row</th> : null}
            {headers.map((header) => (
              <th key={header} className="border border-slate-200 px-3 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row.label ?? 'row'}-${rowIndex}`}>
              {rows.some((entry) => entry.label) ? (
                <td className="border border-slate-200 px-3 py-2 text-left font-medium">{row.label ?? ''}</td>
              ) : null}
              {row.values.map((value, valueIndex) => (
                <td key={`${value}-${valueIndex}`} className="border border-slate-200 px-3 py-3 text-lg font-semibold">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ArithmeticLayoutRenderer({ visual }: { visual: ArithmeticLayoutVisual }) {
  if (visual.layout === 'place-value-table') {
    return renderPlaceValueTable(visual);
  }

  const rows = visual.operands ?? [];
  const answerRow = visual.showAnswer && visual.answer ? [...rows, visual.answer] : rows;
  const maxWidth = Math.max(...answerRow.map((entry) => splitDigits(entry).length), 1);

  return (
    <svg viewBox={`0 0 ${maxWidth * 32 + 72} ${(rows.length + 2) * 38 + 32}`} className="w-full max-w-sm">
      <rect
        x="8"
        y="8"
        width={maxWidth * 32 + 56}
        height={(rows.length + 2) * 38 + 16}
        rx="18"
        fill={mathsVisualTheme.panel}
        stroke="#e2e8f0"
      />
      {rows.map((row, rowIndex) => {
        const digits = splitDigits(row);
        const startX = 48 + (maxWidth - digits.length) * 32;
        const y = 46 + rowIndex * 38;
        return (
          <g key={`${row}-${rowIndex}`}>
            {visual.showOperator && rowIndex === rows.length - 1 && visual.operator ? (
              <text x="26" y={y} fontSize="22" fill={mathsVisualTheme.stroke} fontFamily={mathsVisualTheme.fontFamily}>
                {visual.operator}
              </text>
            ) : null}
            {digits.map((digit, digitIndex) => (
              <text
                key={`${digit}-${digitIndex}`}
                x={startX + digitIndex * 32}
                y={y}
                fontSize="22"
                fill={mathsVisualTheme.stroke}
                fontFamily={mathsVisualTheme.fontFamily}
              >
                {digit}
              </text>
            ))}
          </g>
        );
      })}
      {visual.showAnswerLine ? (
        <line
          x1="38"
          x2={maxWidth * 32 + 36}
          y1={rows.length * 38 + 24}
          y2={rows.length * 38 + 24}
          stroke={mathsVisualTheme.stroke}
          strokeWidth={2}
        />
      ) : null}
      {visual.showAnswer && visual.answer ? (
        <g>
          {splitDigits(visual.answer).map((digit, digitIndex, digits) => (
            <text
              key={`${digit}-${digitIndex}`}
              x={48 + (maxWidth - digits.length) * 32 + digitIndex * 32}
              y={rows.length * 38 + 54}
              fontSize="22"
              fill={mathsVisualTheme.accent}
              fontFamily={mathsVisualTheme.fontFamily}
            >
              {digit}
            </text>
          ))}
        </g>
      ) : null}
    </svg>
  );
}
