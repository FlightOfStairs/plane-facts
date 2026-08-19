import { useState } from "react";
import { AppBar, Container, CssBaseline, MenuItem, Select, Toolbar, Typography } from "@mui/material";
import FlightIcon from "@mui/icons-material/Flight";
import { Disclaimer } from "./components/Disclaimer";
import { CHART_PAGES } from "./pages";

function App() {
  const [chartId, setChartId] = useState(CHART_PAGES[0]!.id);
  const chart = CHART_PAGES.find((c) => c.id === chartId) ?? CHART_PAGES[0]!;
  const Page = chart.Component;
  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <FlightIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            Plane Facts — PA-28-161 Performance
          </Typography>
          <Select size="small" value={chartId} onChange={(e) => setChartId(e.target.value)} sx={{ minWidth: 280, bgcolor: "background.paper" }}>
            {CHART_PAGES.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.label}
              </MenuItem>
            ))}
          </Select>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Page />
        <Disclaimer />
      </Container>
    </>
  );
}

export default App;
