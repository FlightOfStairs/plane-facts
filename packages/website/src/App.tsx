import { useState } from "react";
import { AppBar, Container, CssBaseline, MenuItem, Select, Toolbar, Typography } from "@mui/material";
import FlightIcon from "@mui/icons-material/Flight";
import { Disclaimer } from "./components/Disclaimer";
import { TakeoffGroundRoll25Page } from "./pages/TakeoffGroundRoll25Page";

const CHARTS = [{ id: "fig-5-11", label: "Takeoff ground roll — flaps 25° (Fig 5-11)", page: TakeoffGroundRoll25Page }];

function App() {
  const [chartId, setChartId] = useState(CHARTS[0]!.id);
  const chart = CHARTS.find((c) => c.id === chartId) ?? CHARTS[0]!;
  const Page = chart.page;
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
            {CHARTS.map((c) => (
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
