import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import { api } from "./api.js";
import Login from "./pages/Login.jsx";
import InquiriesList from "./pages/InquiriesList.jsx";
import InquiryDetail from "./pages/InquiryDetail.jsx";
import Templates from "./pages/Templates.jsx";
import Manuals from "./pages/Manuals.jsx";
import DeliveryRules from "./pages/DeliveryRules.jsx";
import Settings from "./pages/Settings.jsx";
import OnboardTenant from "./pages/OnboardTenant.jsx";

export default function App() {
  const [session, setSession] = useState(undefined);
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState(localStorage.getItem("rms_tenant_id") || "");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    api.listTenants().then(({ tenants }) => {
      setTenants(tenants);
      if (tenants.length > 0 && !tenants.find((t) => t.id === tenantId)) {
        setTenantId(tenants[0].id);
        localStorage.setItem("rms_tenant_id", tenants[0].id);
      }
    });
  }, [session]);

  function switchTenant(id) {
    setTenantId(id);
    localStorage.setItem("rms_tenant_id", id);
  }

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem("rms_tenant_id");
    navigate("/login");
  }

  if (session === undefined) return <div className="loading">読み込み中…</div>;
  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  if (tenants.length === 0) {
    return (
      <Routes>
        <Route
          path="*"
          element={
            <OnboardTenant
              onCreated={(t) => {
                setTenants([t]);
                setTenantId(t.id);
                localStorage.setItem("rms_tenant_id", t.id);
                navigate("/");
              }}
            />
          }
        />
      </Routes>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>RMS問い合わせ管理</h1>
        <div className="topbar-controls">
          <select value={tenantId} onChange={(e) => switchTenant(e.target.value)}>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <span className="user-email">{session.user.email}</span>
          <button onClick={signOut}>ログアウト</button>
        </div>
      </header>
      <nav className="sidenav">
        <NavLink to="/" end>問い合わせ</NavLink>
        <NavLink to="/templates">テンプレート</NavLink>
        <NavLink to="/manuals">マニュアル</NavLink>
        <NavLink to="/delivery-rules">納期ルール</NavLink>
        <NavLink to="/settings">設定</NavLink>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<InquiriesList tenantId={tenantId} />} />
          <Route path="/inquiries/:id" element={<InquiryDetail tenantId={tenantId} />} />
          <Route path="/templates" element={<Templates tenantId={tenantId} />} />
          <Route path="/manuals" element={<Manuals tenantId={tenantId} />} />
          <Route path="/delivery-rules" element={<DeliveryRules tenantId={tenantId} />} />
          <Route path="/settings" element={<Settings tenantId={tenantId} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
