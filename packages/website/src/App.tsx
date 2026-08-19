import { useLayoutEffect } from "react";
import { AppBar, Box, Container, CssBaseline, MenuItem, TextField, Toolbar, Typography } from "@mui/material";
import FlightIcon from "@mui/icons-material/Flight";
import { Disclaimer } from "./components/Disclaimer";
import { useUrlState } from "./lib/urlState";
import { CHART_PAGES, chartTitle } from "./pages";

function App() {
  const [{ chart: chartId }, setUrl] = useUrlState({ chart: CHART_PAGES[0]!.id });
  const chart = CHART_PAGES.find((c) => c.id === chartId) ?? CHART_PAGES[0]!;
  const Page = chart.Component;

  // Names the tab on first render as well as on every change, so a shared
  // link opens already titled. Layout effect, so the static index.html title
  // is never shown even for a frame.
  useLayoutEffect(() => {
    document.title = chartTitle(chart.label);
  }, [chart.label]);
  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <FlightIcon sx={{ mr: 1 }} />
          {/* Long title truncates rather than wrapping to three lines on a phone. */}
          <Typography variant="h6" component="h1" noWrap sx={{ flexGrow: 1, fontSize: { xs: "1.05rem", sm: "1.25rem" } }}>
            Plane Facts
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              {" — PA-28-161 Performance"}
            </Box>
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Disclaimer />
        {/* Chart picker lives in the page, not the app bar: at phone widths a
            bar-mounted select overflowed its own dropdown arrow and read as
            decoration rather than a control. */}
        <TextField select fullWidth size="small" label="Performance chart" value={chartId} onChange={(e) => setUrl({ chart: e.target.value })} sx={{ mb: 2, maxWidth: { sm: 480 } }}>
          {CHART_PAGES.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>
        <Page />
      </Container>
    </>
  );
}

export default App;
