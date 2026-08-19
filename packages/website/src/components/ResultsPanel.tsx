import { Alert, Divider, Stack, Typography } from "@mui/material";

export interface ResultRow {
  label: string;
  value: string;
  emphasize?: boolean;
}

/** Numeric outputs of a model: correction chain + final values + warnings. */
export function ResultsPanel(props: { rows: ResultRow[]; warnings: string[] }) {
  return (
    <Stack spacing={1}>
      {props.rows.map((row) => (
        <Stack key={row.label} direction="row" spacing={2} sx={{ justifyContent: "space-between" }}>
          <Typography variant={row.emphasize ? "body1" : "body2"}>{row.label}</Typography>
          <Typography variant={row.emphasize ? "body1" : "body2"} sx={{ fontWeight: row.emphasize ? "bold" : undefined, whiteSpace: "nowrap" }}>
            {row.value}
          </Typography>
        </Stack>
      ))}
      {props.warnings.length > 0 && <Divider />}
      {props.warnings.map((w) => (
        <Alert key={w} severity="warning" variant="outlined">
          {w}
        </Alert>
      ))}
    </Stack>
  );
}
