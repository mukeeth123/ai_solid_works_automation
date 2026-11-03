// ============================================================
// VOLM Engineering Intelligence — App Root
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './store/appStore';
import { AppShell } from './components/AppShell';
import { Suspense, lazy } from 'react';
import { Spinner } from './components/shared';

const EnquiryWorkspace = lazy(() => import('./pages/EnquiryWorkspace'));
const EngineeringLibrary = lazy(() => import('./pages/EngineeringLibrary'));
const ComparePlan = lazy(() => import('./pages/ComparePlan'));
const CadChangeCentre = lazy(() => import('./pages/CadChangeCentre'));
const MainAssembly = lazy(() => import('./pages/MainAssembly'));
const ReviewRelease = lazy(() => import('./pages/ReviewRelease'));
const ActivityHistory = lazy(() => import('./pages/ActivityHistory'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full gap-3 text-[#68737D]">
      <Spinner size={20} />
      <span className="text-[13px]">Loading...</span>
    </div>
  );
}

function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <AppShell>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/library" replace />} />
              <Route path="/library" element={<EngineeringLibrary />} />
              <Route path="/compare" element={<ComparePlan />} />
              <Route path="/reuse-comparison" element={<ComparePlan />} />
              <Route path="/cad-change" element={<CadChangeCentre />} />
              <Route path="/main-assembly" element={<MainAssembly />} />
              <Route path="/review" element={<ReviewRelease />} />
              <Route path="/history" element={<ActivityHistory />} />
              <Route path="/enquiries" element={<EnquiryWorkspace />} />
              <Route path="*" element={<Navigate to="/library" replace />} />
            </Routes>
          </Suspense>
        </AppShell>
      </BrowserRouter>
    </StoreProvider>
  );
}

export default App;
