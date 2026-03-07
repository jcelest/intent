"use client";

const AUTH_COOKIE = "intent_auth";

export function LogoutLink() {
  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
    window.location.href = "/admin/login";
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm font-mono text-slate-400 hover:text-red-400 transition-colors"
    >
      Log out
    </button>
  );
}
