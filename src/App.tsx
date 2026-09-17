import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { GuidePage } from "./pages/GuidePage";
import { HallOfFamePage } from "./pages/HallOfFamePage";
import { PlayPage } from "./pages/PlayPage";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PlayPage />} />
          <Route path="guide" element={<GuidePage />} />
          <Route path="hall-of-fame" element={<HallOfFamePage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
