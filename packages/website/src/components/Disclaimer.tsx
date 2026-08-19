import { Alert } from "@mui/material";

export function Disclaimer() {
  return (
    <Alert severity="info" sx={{ mt: 2 }}>
      Study and planning tool only, built from reverse-engineered models of the 1982 POH charts (Report VB-1180). Not a substitute for the POH/AFM — always verify performance against your aircraft&apos;s own documents. Chart overlays are illustrative; all numbers come from the fitted models.
    </Alert>
  );
}
