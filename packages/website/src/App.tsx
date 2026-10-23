import { useLayoutEffect } from "react";
import { AppBar, Box, Container, CssBaseline, MenuItem, Tab, Tabs, TextField, Toolbar, Typography } from "@mui/material";
import FlightIcon from "@mui/icons-material/Flight";
import { Disclaimer } from "./components/Disclaimer";
import { useUrlState } from "./lib/urlState";
import { CHART_PAGES, chartTitle } from "./pages";
import { PRACTISE_PAGES } from "./practise";

function App() {
  const [{ section, chart: chartId, drill: drillId }, setUrl] = useUrlState({ section: "performance", chart: CHART_PAGES[0]!.id, drill: PRACTISE_PAGES[0]!.id });
  const practise = section === "practise";
  const pages = practise ? PRACTISE_PAGES : CHART_PAGES;
  const selectedId = practise ? drillId : chartId;
  const page = pages.find((c) => c.id === selectedId) ?? pages[0]!;
  const Page = page.Component;

  // Names the tab on first render as well as on every change, so a shared
  // link opens already titled. Layout effect, so the static index.html title
  // is never shown even for a frame.
  useLayoutEffect(() => {
    document.title = chartTitle(page.label);
  }, [page.label]);
  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <FlightIcon sx={{ mr: 1 }} />
          {/* Long title truncates rather than wrapping to three lines on a phone. */}
          <Typography variant="h6" component="h1" noWrap sx={{ flexGrow: 1, fontSize: { xs: "1.05rem", sm: "1.25rem" } }}>
            Plane Facts
            <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
              {practise ? " — Practise" : " — PA-28-161 Performance"}
            </Box>
          </Typography>
          <Tabs value={practise ? "practise" : "performance"} onChange={(_, v: string) => setUrl({ section: v })} textColor="inherit" indicatorColor="secondary" sx={{ alignSelf: "stretch", "& .MuiTabs-flexContainer": { height: "100%" } }}>
            <Tab value="performance" label="Performance" sx={{ minWidth: 0, px: { xs: 1, sm: 2 } }} />
            <Tab value="practise" label="Practise" sx={{ minWidth: 0, px: { xs: 1, sm: 2 } }} />
          </Tabs>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {!practise && <Disclaimer />}
        {/* Page picker lives in the page, not the app bar: at phone widths a
            bar-mounted select overflowed its own dropdown arrow and read as
            decoration rather than a control. */}
        <TextField select fullWidth size="small" label={practise ? "Practise tool" : "Performance chart"} value={page.id} onChange={(e) => setUrl(practise ? { drill: e.target.value } : { chart: e.target.value })} sx={{ mb: 2, maxWidth: { sm: 480 } }}>
          {pages.map((c) => (
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
