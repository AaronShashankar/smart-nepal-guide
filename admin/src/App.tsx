import { Center, Loader } from '@mantine/core';
import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AuthProvider, useAuth } from './auth';
import Layout from './components/Layout';
import Categories from './pages/Categories';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Places from './pages/Places';
import Permits from './pages/Permits';
import Reviews from './pages/Reviews';
import TrekForm from './pages/TrekForm';
import Treks from './pages/Treks';
import Users from './pages/Users';

// The place form carries the MapLibre map (~1 MB), so load it only when opened.
const PlaceForm = lazy(() => import('./pages/PlaceForm'));

const spinner = (
  <Center h="60vh">
    <Loader />
  </Center>
);

function RequireAdmin({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return spinner;
  return me ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAdmin>
                <Layout />
              </RequireAdmin>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="places" element={<Places />} />
            <Route
              path="places/new"
              element={
                <Suspense fallback={spinner}>
                  <PlaceForm />
                </Suspense>
              }
            />
            <Route
              path="places/:id"
              element={
                <Suspense fallback={spinner}>
                  <PlaceForm />
                </Suspense>
              }
            />
            <Route path="treks" element={<Treks />} />
            <Route path="treks/new" element={<TrekForm />} />
            <Route path="treks/:id" element={<TrekForm />} />
            <Route path="categories" element={<Categories />} />
            <Route path="permits" element={<Permits />} />
            <Route path="users" element={<Users />} />
            <Route path="reviews" element={<Reviews />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
