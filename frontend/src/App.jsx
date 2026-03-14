import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from './i18n';
import Landing from './pages/Landing';
import Demo from './pages/Demo';
import FullSystem from './pages/FullSystem';
import Patients from './pages/Patients';

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/system" element={<FullSystem />} />
          <Route path="/patients" element={<Patients />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
