import { Box, Card, CardContent, Typography } from "@mui/material";

/**
 * "About this model" block shown below each chart: the fitted functional
 * form, how well it reproduces the POH, and chart-specific findings.
 */
export function ModelNotes(props: {
  /** Formula line(s), rendered monospace. */
  form: string | string[];
  /** Fit quality + worked-example validation, one or two sentences. */
  fit: string;
  /** Interesting chart-specific findings, one bullet each. */
  findings: string[];
}) {
  const formLines = Array.isArray(props.form) ? props.form : [props.form];
  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>
          About this model
        </Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            mb: 1,
            p: 1,
            bgcolor: "action.hover",
            borderRadius: 1,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.8rem",
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          {formLines.join("\n")}
        </Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {props.fit}
        </Typography>
        <Typography variant="subtitle2">Notable findings</Typography>
        <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 3 }}>
          {props.findings.map((f) => (
            <Typography key={f.slice(0, 40)} component="li" variant="body2">
              {f}
            </Typography>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
