import { AppBar, Container, CssBaseline, Toolbar, Typography } from "@mui/material";
import FlightIcon from "@mui/icons-material/Flight";

function App() {
  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <FlightIcon sx={{ mr: 1 }} />
          <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
            Plane Facts
          </Typography>
        </Toolbar>
      </AppBar>
      <Container sx={{ paddingY: 5 }}>
        <Typography variant="body1">Coming soon.</Typography>
      </Container>
    </>
  );
}

export default App;
