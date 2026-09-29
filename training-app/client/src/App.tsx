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
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/assessment/access/:token" element={<AssessmentAccess />} />
    <Route path="/dashboard" element={protectedPage(<Dashboard />)} />
    <Route path="/my-events" element={protectedPage(<MyEvents />)} />
    <Route path="/my-events/:eventId/questions" element={protectedPage(<QuestionEditor />)} />
  <Route path="/events" element={protectedPage(<EventList />)} />
    <Route path="/events/new" element={protectedPage(<EventForm />)} />
    <Route path="/events/:id/invitation" element={protectedPage(<EventInvitation />)} />
    <Route path="/events/:id" element={protectedPage(<EventDetail />)} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);
