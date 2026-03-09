import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CandidatePage from './pages/CandidatePage';
import RecruiterDashboard from './pages/RecruiterDashboard';
import ReportPage from './pages/ReportPage';
import { SessionProvider } from './context/SessionContext';

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/candidate/:sessionId" element={<CandidatePage />} />
          <Route path="/dashboard" element={<RecruiterDashboard />} />
          <Route path="/dashboard/:sessionId" element={<RecruiterDashboard />} />
          <Route path="/report/:sessionId" element={<ReportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
