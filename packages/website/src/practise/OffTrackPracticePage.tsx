import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Grid, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import type { ResultRow } from "../components/ResultsPanel";
import { ResultsPanel } from "../components/ResultsPanel";
import type { Grade, Question, Scenario, Technique } from "./offTrack";
import { formatHeading, generateScenario, gradeQuestion, LEG_NM, TECHNIQUE_IDS, TECHNIQUES, TIME_TOLERANCE_MIN, TOLERANCE_DEG } from "./offTrack";
import { OffTrackMap } from "./OffTrackMap";

interface Attempt {
  technique: Technique;
  ok: boolean;
  ms: number;
}

interface Answered {
  answers: number[];
  grades: Grade[];
  ms: number;
}

const QUARTER_LABEL: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };
const MULTIPLIER_LABEL: Record<number, string> = { 0.25: "1⅓", 0.5: "2", 0.75: "4" };

function parseAnswer(q: Question, raw: string): number | undefined {
  if (!/^\d{1,3}$/.test(raw.trim())) return undefined;
  const n = Number(raw);
  if (q.unit === "heading") return n <= 360 ? n : undefined;
  return n > 0 ? n : undefined;
}

function formatValue(q: Question, v: number, exact = false): string {
  if (q.unit === "heading") return formatHeading(v);
  return `${v.toFixed(exact ? 1 : 0)} min`;
}

function formatError(q: Question, error: number): string {
  const sign = error > 0 ? "+" : "";
  return q.unit === "heading" ? `${sign}${error.toFixed(0)}°` : `${sign}${error.toFixed(1)} min`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const side = (nm: number) => (nm > 0 ? "right" : "left");

/** How the technique's rule of thumb reaches each answer. */
function working(s: Scenario): ResultRow[] {
  const turn = s.offTrackNm > 0 ? "left" : "right";
  const te = s.trackErrorDeg;
  const rows: ResultRow[] = [
    { label: "Off track", value: `${Math.abs(s.offTrackNm).toFixed(1)} nm ${side(s.offTrackNm)}` },
    { label: "Flown / to go", value: `${s.alongNm.toFixed(1)} / ${s.remainingNm.toFixed(1)} nm` },
    { label: "Track error (60 × off ÷ flown)", value: `${te.toFixed(0)}°` },
  ];
  const [first, second, third] = s.questions;
  switch (s.technique) {
    case "fraction":
      rows.push({ label: `At ${QUARTER_LABEL[s.quartile]}: TE × ${MULTIPLIER_LABEL[s.quartile]} → turn ${turn} ${(te * s.multiplier).toFixed(0)}°`, value: formatHeading(first!.rule) });
      break;
    case "oneInSixty":
      rows.push({ label: "Closing angle (60 × off ÷ to go)", value: `${s.closingAngleDeg.toFixed(0)}°` }, { label: `TE + CA → turn ${turn} ${(te + s.closingAngleDeg).toFixed(0)}°`, value: formatHeading(first!.rule) });
      break;
    case "double":
      rows.push({ label: `Double: turn ${turn} 2 × TE = ${(2 * te).toFixed(0)}°`, value: formatHeading(first!.rule) }, { label: "Hold for the time already flown", value: formatValue(second!, second!.rule) }, { label: `Back on track: turn back TE (${te.toFixed(0)}°)`, value: formatHeading(third!.rule) });
      break;
  }
  return rows;
}

function AnswerField(props: { question: Question; value: string; invalid: boolean; readOnly: boolean; inputRef: (el: HTMLInputElement | null) => void; onChange: (v: string) => void; index: number; onEnter: (index: number) => void }) {
  const { question: q } = props;
  return (
    <TextField
      inputRef={props.inputRef}
      size="small"
      label={q.label}
      value={props.value}
      error={props.invalid}
      helperText={props.invalid ? (q.unit === "heading" ? "Enter 0–360" : "Enter whole minutes") : " "}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        props.onEnter(props.index);
      }}
      slotProps={{
        input: { readOnly: props.readOnly, endAdornment: <InputAdornment position="end">{q.unit === "heading" ? "°" : "min"}</InputAdornment> },
        htmlInput: { inputMode: "numeric", autoComplete: "off" },
      }}
      sx={{ width: 220 }}
    />
  );
}

function OffTrackPracticePage() {
  const [scenario, setScenario] = useState<Scenario>(() => generateScenario());
  const [startedMs, setStartedMs] = useState(() => performance.now());
  const [inputs, setInputs] = useState<string[]>(() => scenario.questions.map(() => ""));
  const [invalid, setInvalid] = useState<boolean[]>([]);
  const [answered, setAnswered] = useState<Answered | undefined>();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const focusOnNewLeg = useRef(false);

  // Ready to type straight away at a desk; on touch screens the keyboard would
  // cover the map before the leg has been seen.
  useEffect(() => {
    if (window.matchMedia?.("(pointer: fine)").matches) inputRefs.current[0]?.focus();
  }, []);

  const submit = () => {
    const answers = scenario.questions.map((q, i) => parseAnswer(q, inputs[i] ?? ""));
    const bad = answers.map((a) => a === undefined);
    if (bad.some(Boolean)) {
      setInvalid(bad);
      inputRefs.current[bad.indexOf(true)]?.focus();
      return;
    }
    const valid = answers.filter((a): a is number => a !== undefined);
    const ms = performance.now() - startedMs;
    const grades = scenario.questions.map((q, i) => gradeQuestion(q, valid[i]!));
    setAnswered({ answers: valid, grades, ms });
    setAttempts((prev) => [...prev, { technique: scenario.technique, ok: grades.every((g) => g.ok), ms }]);
  };

  const next = () => {
    const s = generateScenario();
    setScenario(s);
    setStartedMs(performance.now());
    setInputs(s.questions.map(() => ""));
    setInvalid([]);
    setAnswered(undefined);
    focusOnNewLeg.current = true;
  };

  // Enter steps through the fields, checks on the last, then moves to the next leg.
  const onEnter = (i: number) => {
    if (answered) next();
    else if (i < scenario.questions.length - 1) inputRefs.current[i + 1]?.focus();
    else submit();
  };

  let streak = 0;
  for (let i = attempts.length - 1; i >= 0 && attempts[i]!.ok; i--) streak++;
  const correct = attempts.filter((a) => a.ok).length;
  const perTechnique = TECHNIQUE_IDS.flatMap((t): ResultRow[] => {
    const mine = attempts.filter((a) => a.technique === t);
    return mine.length ? [{ label: TECHNIQUES[t], value: `${mine.filter((a) => a.ok).length}/${mine.length}`, secondary: true }] : [];
  });

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Off-track correction
            </Typography>
            <Box sx={{ width: "100%", aspectRatio: "1 / 1" }}>
              <OffTrackMap scenario={scenario} revealed={answered !== undefined} />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              Triangle = departure, circle = destination. 10° fan lines open out of the departure and close into the destination. Bars across the track mark 2 nm either side at ¼ and ¾, and 5 nm at ½.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Situation
            </Typography>
            <ResultsPanel
              rows={[
                { label: "Flown heading", value: formatHeading(scenario.flownHeading), emphasize: true },
                { label: "Time since departure", value: `${scenario.minutesFlown} min` },
                { label: "Planned track", value: formatHeading(scenario.trackDeg) },
                { label: "Leg length", value: `${scenario.legNm.toFixed(0)} nm` },
              ]}
              warnings={[]}
            />
            <Typography variant="body2" sx={{ mt: 2, mb: 1.5 }}>
              {scenario.technique === "double" ? "You have flown the heading above since departure. Regain the planned track: what heading, for how long, and what heading once back on track?" : "You have flown the heading above since departure. What heading takes you direct to the destination?"}
            </Typography>
            <Stack spacing={0.5}>
              {scenario.questions.map((q, i) => (
                <AnswerField
                  key={q.id}
                  question={q}
                  value={inputs[i] ?? ""}
                  invalid={invalid[i] ?? false}
                  readOnly={answered !== undefined}
                  inputRef={(el) => {
                    inputRefs.current[i] = el;
                    // Runs once the new leg's fields exist, which may differ in number from the last leg's.
                    if (el && i === 0 && focusOnNewLeg.current) {
                      focusOnNewLeg.current = false;
                      el.focus();
                    }
                  }}
                  onChange={(v) => {
                    setInputs((prev) => prev.map((old, j) => (j === i ? v : old)));
                    setInvalid((prev) => prev.map((old, j) => (j === i ? false : old)));
                  }}
                  index={i}
                  onEnter={onEnter}
                />
              ))}
            </Stack>
            <Button variant="contained" onClick={() => (answered ? next() : submit())}>
              {answered ? "Next" : "Check"}
            </Button>
            {answered && (
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Alert severity={answered.grades.every((g) => g.ok) ? "success" : "error"}>
                  {scenario.questions.map((q, i) => (
                    <Box key={q.id}>
                      {answered.grades[i]!.ok ? "✓" : "✗"} {q.label}: you {formatValue(q, answered.answers[i]!)}, exact {formatValue(q, q.exact, true)} ({formatError(q, answered.grades[i]!.error)})
                    </Box>
                  ))}
                  <Box sx={{ mt: 0.5 }}>Answered in {seconds(answered.ms)}.</Box>
                </Alert>
                <Typography variant="subtitle2">{TECHNIQUES[scenario.technique]}</Typography>
                <ResultsPanel rows={working(scenario)} warnings={[]} />
                <Typography variant="caption" color="text.secondary">
                  Press Enter for the next leg.
                </Typography>
              </Stack>
            )}
          </CardContent>
        </Card>
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              This session
            </Typography>
            <ResultsPanel rows={attempts.length ? [{ label: "Attempts", value: String(attempts.length) }, { label: "All parts correct", value: `${correct} (${Math.round((100 * correct) / attempts.length)}%)` }, ...perTechnique, { label: "Median time", value: seconds(median(attempts.map((a) => a.ms))) }, { label: "Current streak", value: String(streak) }] : [{ label: "No attempts yet", value: "", secondary: true }]} warnings={[]} />
          </CardContent>
        </Card>
        <Alert severity="info" sx={{ mt: 2 }}>
          Training aid only, not for navigation. Legs are random {LEG_NM.min}–{LEG_NM.max} nm over Scotland, each testing the fraction-of-leg shortcut, double track error or the 1-in-60 rule. Headings within ±{TOLERANCE_DEG}° and times within ±{TIME_TOLERANCE_MIN} min of exact count. Headings and tracks are true, with no magnetic variation. Exact answers assume the drift so far continues.
        </Alert>
      </Grid>
    </Grid>
  );
}

export const chartEntry = { id: "offtrack", label: "Off-track correction", Component: OffTrackPracticePage };
