import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import './index.css';

import { CircuitSvg } from './components/CircuitSvg';

import {
  buildSOPGraph,
  expressionForPOS,
  expressionForSOP,
  expressionFromTable,
  minimizePOS,
  minimizeSOP,
  parseExpression,
  rowsFromTerms,
  truthTable,
  evaluateGraph,
  evaluateSOP,
  type InputMode,
  type TermKind,
  type TruthValue,
} from './engine/boolean';

const vars = ['A', 'B', 'C', 'D', 'E', 'F'];

const bits = (n: number, m: number) =>
  vars
    .slice(0, n)
    .map((_, i) => ((m >> (n - 1 - i)) & 1) as 0 | 1);

function App() {
  const [n, setN] = useState(3);
  const [mode, setMode] = useState<InputMode>('expression');
  const [expr, setExpr] = useState('A XOR B XOR C');
  const [kind, setKind] = useState<TermKind>('minterm');
  const [terms, setTerms] = useState('1,2,4,7');
  const [dc, setDc] = useState('');
  const [table, setTable] = useState<TruthValue[]>(() =>
    Array(8).fill(0)
  );
  const [showHow, setShowHow] = useState(false);

  const parsed = useMemo(() => {
    try {
      return parseExpression(expr);
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : 'Invalid expression',
      } as const;
    }
  }, [expr]);

  /*
   * Convert whichever input mode is selected into ONE canonical
   * truth table. Everything after this point uses this canonical
   * table as the source of truth.
   */
  const canonical = useMemo(() => {
    if (mode === 'expression' && 'evaluate' in parsed) {
      const rows = truthTable(n, parsed.evaluate);
      return expressionFromTable(n, rows);
    }

    if (mode === 'terms') {
      const idx = terms
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
        .map(Number)
        .filter(
          x =>
            Number.isInteger(x) &&
            x >= 0 &&
            x < 2 ** n
        );

      const d = dc
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
        .map(Number)
        .filter(
          x =>
            Number.isInteger(x) &&
            x >= 0 &&
            x < 2 ** n
        );

      const r = rowsFromTerms(n, kind, idx, d);
      return expressionFromTable(n, r);
    }

    return expressionFromTable(
      n,
      Array.from(
        { length: 2 ** n },
        (_, i) => table[i] ?? 0
      )
    );
  }, [
    mode,
    n,
    parsed,
    terms,
    dc,
    kind,
    table,
  ]);

  const sop = minimizeSOP(
    canonical.minterms,
    canonical.dc,
    n
  );

  const pos = minimizePOS(
    canonical.zeros,
    canonical.dc,
    n
  );

  /*
   * Preserve constant minimization results.
   *
   * expressionForSOP([]) would otherwise return "0",
   * even when minimizeSOP() correctly determined that
   * the function is the constant 1.
   */
  const sopExpr =
    sop.implicants.length === 0
      ? String(sop.constant)
      : expressionForSOP(
          sop.implicants,
          n
        );

  /*
   * Preserve constant POS results as well.
   */
  const posExpr =
    pos.implicants.length === 0
      ? String(pos.constant)
      : expressionForPOS(
          pos.implicants,
          n
        );

  const [form, setForm] = useState<'SOP' | 'POS'>(
    'SOP'
  );

  const chosen =
    form === 'SOP' ? sopExpr : posExpr;

  const sopConstant = (
    sop.implicants.length === 0
      ? sop.constant
      : 0
  ) as 0 | 1;

  const posConstant = (
    pos.implicants.length === 0
      ? pos.constant
      : 0
  ) as 0 | 1;

  const basic = buildSOPGraph(
    sop.implicants,
    n,
    'basic',
    sopConstant
  );

  const nand = buildSOPGraph(
    sop.implicants,
    n,
    'nand',
    sopConstant
  );

  const nor = buildSOPGraph(
    pos.implicants,
    n,
    'nor',
    posConstant
  );

  /*
   * IMPORTANT FIX:
   *
   * The canonical truth table is the single source of truth.
   *
   * Previously the "Original" verification value could be
   * calculated through a different path from the input table.
   * That caused cases such as:
   *
   * Input table:  1 1 -> 0
   * Verification: 1 1 -> 1
   *
   * Now the original value is obtained directly from
   * canonical.minterms.
   */
  const originalEval = (
    a: Record<string, 0 | 1>
  ): 0 | 1 => {
    const m = vars
      .slice(0, n)
      .reduce(
        (value, variable) =>
          value * 2 + a[variable],
        0
      );

    return canonical.minterms.includes(m)
      ? 1
      : 0;
  };

  const simplifiedParsed = useMemo(() => {
    try {
      return parseExpression(chosen);
    } catch {
      return null;
    }
  }, [chosen]);

  const simplifiedEval = (
    a: Record<string, 0 | 1>
  ): 0 | 1 => {
    if (simplifiedParsed) {
      return simplifiedParsed.evaluate(a);
    }

    if (form === 'SOP') {
      return evaluateSOP(chosen, a);
    }

    if (chosen === '1') {
      return 1;
    }

    if (chosen === '0') {
      return 0;
    }

    /*
     * POS is already parsed above in normal cases.
     * This fallback only matters if parsing failed.
     */
    return 0;
  };

  const rows = Array.from(
    { length: 2 ** n },
    (_, m) => {
      const a = Object.fromEntries(
        bits(n, m).map((b, i) => [
          vars[i],
          b,
        ])
      ) as Record<string, 0 | 1>;

      const original = originalEval(a);
      const simplified = simplifiedEval(a);
      const nandValue = evaluateGraph(
        nand,
        a
      );
      const norValue = evaluateGraph(
        nor,
        a
      );

      return {
        m,
        a,
        o: original,
        s: simplified,
        nand: nandValue,
        nor: norValue,
      };
    }
  );

  const score = {
    simplified: rows.filter(
      r => r.o === r.s
    ).length,

    nand: rows.filter(
      r => r.o === r.nand
    ).length,

    nor: rows.filter(
      r => r.o === r.nor
    ).length,
  };

  const allPass =
    score.simplified === rows.length &&
    score.nand === rows.length &&
    score.nor === rows.length;

  const setTab = (
    i: number,
    value: TruthValue
  ) => {
    setTable(t =>
      t.map((x, j) =>
        j === i ? value : x
      )
    );
  };

  const copy = () =>
    navigator.clipboard?.writeText(chosen);

  return (
    <div className="min-h-screen text-slate-100">
      <header className="mx-auto max-w-7xl px-4 pt-8 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[.25em] text-cyan-300">
              Digital logic toolkit
            </div>

            <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
              Boolean Logic Simplifier{' '}
              <span className="text-cyan-300">
                &
              </span>{' '}
              Circuit Visualizer
            </h1>

            <p className="mt-2 max-w-3xl text-slate-400">
              From truth table, minterms/maxterms,
              or an expression to Quine–McCluskey
              minimization, universal-gate circuits,
              and exhaustive verification.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-12 space-y-5">

        {/* INPUT */}
        <section className="glass rounded-3xl p-5 grid-bg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">
              1 · Input
            </h2>

            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-slate-500">
                Variables
              </span>

              <select
                value={n}
                onChange={e => {
                  const k = Number(e.target.value);
                  setN(k);
                  setTable(
                    Array(2 ** k).fill(0)
                  );
                }}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              >
                {[2, 3, 4, 5, 6].map(k => (
                  <option key={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 rounded-xl bg-slate-900/70 p-1">
            {(
              [
                [
                  'expression',
                  'Boolean expression',
                ],
                [
                  'terms',
                  'Minterms / Maxterms',
                ],
                [
                  'truth',
                  'Truth table',
                ],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() =>
                  setMode(id)
                }
                className={`rounded-lg px-3 py-2 text-sm ${
                  mode === id
                    ? 'bg-cyan-500/15 text-cyan-200'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'expression' && (
            <div className="mt-4">
              <input
                value={expr}
                onChange={e =>
                  setExpr(e.target.value)
                }
                placeholder="e.g. (A+B')C XOR D"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 mono text-lg outline-none focus:border-cyan-400"
              />

              <div className="mt-2 text-xs text-slate-500">
                Syntax: <b>AND</b> / <b>·</b> /{' '}
                <b>*</b> · <b>OR</b> / <b>+</b> ·{' '}
                <b>NOT</b> / <b>'</b> / <b>!</b> /{' '}
                <b>¬</b> · <b>XOR</b> · parentheses ·
                variables A–F. Implicit AND like{' '}
                <span className="mono">
                  AB'
                </span>{' '}
                is accepted.
              </div>

              {'error' in parsed && (
                <div className="mt-3 flex items-center gap-2 text-rose-300 text-sm">
                  <AlertTriangle size={16} />
                  {parsed.error}
                </div>
              )}
            </div>
          )}

          {mode === 'terms' && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500">
                  Indices
                </label>

                <input
                  value={terms}
                  onChange={e =>
                    setTerms(e.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 mono"
                  placeholder="0,2,5,7"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500">
                  Interpret as
                </label>

                <div className="mt-1 flex rounded-xl border border-slate-700 bg-slate-950 p-1">
                  {(
                    [
                      'minterm',
                      'maxterm',
                    ] as const
                  ).map(k => (
                    <button
                      key={k}
                      onClick={() =>
                        setKind(k)
                      }
                      className={`flex-1 rounded-lg py-2 text-sm ${
                        kind === k
                          ? 'bg-cyan-500/15 text-cyan-200'
                          : ''
                      }`}
                    >
                      {k[0].toUpperCase() +
                        k.slice(1)}
                      s
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="text-xs text-slate-500">
                  Don't-care indices (optional)
                </label>

                <input
                  value={dc}
                  onChange={e =>
                    setDc(e.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 mono"
                  placeholder="e.g. 1,3"
                />
              </div>
            </div>
          )}

          {mode === 'truth' && (
            <div className="mt-4 overflow-auto rounded-xl border border-slate-700">
              <table className="min-w-full text-center text-sm">
                <thead className="bg-slate-900">
                  <tr>
                    {vars
                      .slice(0, n)
                      .map(v => (
                        <th
                          key={v}
                          className="px-3 py-2"
                        >
                          {v}
                        </th>
                      ))}

                    <th className="px-3 py-2">
                      Output
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {Array.from(
                    { length: 2 ** n },
                    (_, m) => (
                      <tr
                        key={m}
                        className="border-t border-slate-800"
                      >
                        {bits(n, m).map(
                          (b, i) => (
                            <td
                              key={i}
                              className="px-3 py-2 text-slate-400"
                            >
                              {b}
                            </td>
                          )
                        )}

                        <td className="px-3 py-2">
                          <select
                            value={table[m]}
                            onChange={e =>
                              setTab(
                                m,
                                e.target.value ===
                                  'X'
                                  ? 'X'
                                  : (Number(
                                      e.target.value
                                    ) as
                                      | 0
                                      | 1)
                              )
                            }
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5"
                          >
                            <option value={0}>
                              0
                            </option>
                            <option value={1}>
                              1
                            </option>
                            <option value="X">
                              X
                            </option>
                          </select>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5">
              Required 1s:{' '}
              <span className="font-bold text-cyan-200">
                {canonical.minterms.length}
              </span>
            </div>

            <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5">
              Zeros:{' '}
              <span className="font-bold">
                {canonical.zeros.length}
              </span>
            </div>

            <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5">
              Don't-care:{' '}
              <span className="font-bold text-violet-200">
                {canonical.dc.length}
              </span>
            </div>
          </div>
        </section>

        {/* MINIMIZED RESULT */}
        <section className="glass rounded-3xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">
                2 · Minimized result
              </h2>

              <div className="mt-1 text-xs text-slate-500">
                Quine–McCluskey prime implicants +
                minimum cover selection
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1">
                {(['SOP', 'POS'] as const).map(
                  f => (
                    <button
                      key={f}
                      onClick={() =>
                        setForm(f)
                      }
                      className={`px-3 py-1.5 rounded-lg text-sm ${
                        form === f
                          ? 'bg-cyan-500/15 text-cyan-200'
                          : ''
                      }`}
                    >
                      {f}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={copy}
                className="rounded-xl border border-slate-700 px-3 py-2 text-sm flex items-center gap-2"
              >
                <Copy size={16} />
                Copy
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="text-xs uppercase tracking-wider text-cyan-300">
              {form}
            </div>

            <div className="mt-2 mono text-2xl break-words text-white">
              {chosen}
            </div>
          </div>

          <button
            onClick={() =>
              setShowHow(v => !v)
            }
            className="mt-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            How minimization works
            <ChevronDown
              size={16}
              className={
                showHow ? 'rotate-180' : ''
              }
            />
          </button>

          {showHow && (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400 leading-6">
              The engine groups binary minterms by
              number of 1s, repeatedly combines terms
              that differ in exactly one bit, keeps the
              uncombined prime implicants, marks which
              primes cover each required minterm, then
              solves the remaining set-cover problem
              with term-count first and literal-count
              second as the cost. Don't-cares can
              participate in combining but are never
              required in the final cover.
            </div>
          )}
        </section>

        {/* FULL TRUTH TABLE */}
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-bold">
            3 · Full truth table
          </h2>

          <div className="mt-3 overflow-auto rounded-xl border border-slate-700">
            <table className="min-w-full text-center text-sm">
              <thead className="bg-slate-900">
                <tr>
                  {vars
                    .slice(0, n)
                    .map(v => (
                      <th
                        key={v}
                        className="px-3 py-2"
                      >
                        {v}
                      </th>
                    ))}

                  <th>Original</th>
                  <th>Optimized</th>
                  <th>Match</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-800"
                  >
                    {bits(n, i).map(
                      (b, j) => (
                        <td
                          key={j}
                          className="px-3 py-2"
                        >
                          {b}
                        </td>
                      )
                    )}

                    <td>{r.o}</td>
                    <td>{r.s}</td>

                    <td>
                      {r.o === r.s ? (
                        <CheckCircle2
                          size={15}
                          className="inline text-emerald-400"
                        />
                      ) : (
                        <span className="text-rose-400 font-bold">
                          ×
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CIRCUITS */}
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="glass rounded-3xl p-4">
            <CircuitSvg
              graph={basic}
              title="Basic AND / OR / NOT circuit"
            />
          </div>

          <div className="glass rounded-3xl p-4">
            <CircuitSvg
              graph={nand}
              title="NAND-only circuit"
            />
          </div>

          <div className="glass rounded-3xl p-4 lg:col-span-2">
            <CircuitSvg
              graph={nor}
              title="NOR-only circuit"
            />
          </div>
        </section>

        {/* VERIFICATION */}
        <section className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">
                4 · Verification
              </h2>

              <div className="mt-1 text-xs text-slate-500">
                Every input combination is evaluated
                exhaustively.
              </div>
            </div>

            <div
              className={`rounded-full px-3 py-1.5 text-sm border ${
                allPass
                  ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                  : 'border-rose-500/40 text-rose-300 bg-rose-500/10'
              }`}
            >
              {allPass
                ? 'PASS · 100% identical'
                : 'BUG DETECTED · mismatch'}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              [
                'Original',
                rows.length,
              ],
              [
                'Simplified',
                score.simplified,
              ],
              [
                'NAND-only',
                score.nand,
              ],
              [
                'NOR-only',
                score.nor,
              ],
            ].map(([label, count]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
              >
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  {label}
                </div>

                <div className="mt-2 text-2xl font-black text-emerald-300">
                  {count}/{rows.length}
                </div>

                <div className="text-xs text-slate-500">
                  rows aligned
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="pt-2 text-center text-xs text-slate-600">
          Everything runs client-side. No expression
          or truth table data is sent to a server.
        </footer>
      </main>
    </div>
  );
}

createRoot(
  document.getElementById('root')!
).render(<App />);