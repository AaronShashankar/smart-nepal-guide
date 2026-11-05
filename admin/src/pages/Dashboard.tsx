import { useTranslation } from 'react-i18next';

import { useAuth } from '../auth';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { me, logout } = useAuth();
  return (
    <>
      <header className="topbar">
        <strong>{t('title')}</strong>
        <div className="row">
          <select
            aria-label={t('language')}
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
          >
            <option value="en">English</option>
            <option value="ne">नेपाली</option>
          </select>
          <button onClick={logout}>{t('logout')}</button>
        </div>
      </header>
      <main className="page">
        <h1>{t('welcome', { name: me?.full_name ?? me?.email })}</h1>
        <p>{t('comingSoon')}</p>
      </main>
    </>
  );
}
