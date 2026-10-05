import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuth } from './auth/AuthContext.js';
import { DashboardLayout } from './layouts/DashboardLayout.js';
import { Dashboard } from './pages/Dashboard.js';
import { EventForm } from './pages/EventForm.js';
import { EventList } from './pages/EventList.js';
import { EventDetail } from './pages/EventDetail.js';
import { EventInvitation } from './pages/EventInvitation.js';
import { MyEvents } from './pages/MyEvents.js';
import { AssessmentAccess } from './pages/AssessmentAccess.js';
import { QuestionEditor } from './pages/QuestionEditor.js';
import { Login } from './pages/Login.js';
import { EmployeeMonitoring } from './pages/EmployeeMonitoring.js';
import { OjtList } from './pages/OjtList.js';
import { OjtMateriMasterPage } from './pages/OjtMateriMaster.js';
import { OjtMateriQuestionsPage } from './pages/OjtMateriQuestions.js';
import { OjtBatchPage } from './pages/OjtBatch.js';
import { OjtAccessPage } from './pages/OjtAccess.js';
import { TourProvider } from './components/Tour.js';
import { Certificates } from './pages/Certificates.js';
import { CertificatePrint } from './pages/CertificatePrint.js';
import { HowToUse } from './pages/HowToUse.js';

const RequireAuth = ({ children }: { children: ReactElement }) => {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
};

const protectedPage = (element: ReactElement) => (
  <RequireAuth>
    <DashboardLayout>{element}</DashboardLayout>
  </RequireAuth>
);

export const App = () => (
  <TourProvider>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/assessment/access/:token" element={<AssessmentAccess />} />
      {/* Public: an OJT participant reaches this by scanning a QR and has no account. */}
      <Route path="/ojt/access/:token" element={<OjtAccessPage />} />
      <Route path="/dashboard" element={protectedPage(<Dashboard />)} />
      <Route path="/certificates" element={protectedPage(<Certificates />)} />
      <Route path="/certificates/:eventId" element={protectedPage(<CertificatePrint />)} />
      <Route path="/how-to-use" element={protectedPage(<HowToUse />)} />
      <Route path="/employee-monitoring" element={protectedPage(<EmployeeMonitoring />)} />
      <Route path="/ojt" element={protectedPage(<OjtList />)} />
      <Route path="/ojt/materi" element={protectedPage(<OjtMateriMasterPage />)} />
      {/* Literal before the parameter, so this is not read as a batch id. */}
      <Route path="/ojt/materi/:materiId/soal" element={protectedPage(<OjtMateriQuestionsPage />)} />
      <Route path="/ojt/:batchId" element={protectedPage(<OjtBatchPage />)} />
      <Route path="/my-events" element={protectedPage(<MyEvents />)} />
      <Route path="/my-events/:eventId/questions" element={protectedPage(<QuestionEditor />)} />
      <Route path="/events" element={protectedPage(<EventList />)} />
      <Route path="/events/new" element={protectedPage(<EventForm />)} />
      <Route path="/events/:id/invitation" element={protectedPage(<EventInvitation />)} />
      <Route path="/events/:id" element={protectedPage(<EventDetail />)} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </TourProvider>
);
