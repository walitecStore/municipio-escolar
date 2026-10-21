/** Static, before-hydration URL handling. Secrets live only in transient memory. */
export const recoveryBootstrap = `(() => {
  const capture = () => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const queryRecovery = url.searchParams.get('type') === 'recovery';
    const recovery = fragment.get('type') === 'recovery' || fragment.get('error_code') === 'otp_expired' || queryRecovery;
    if (url.pathname !== '/sistema/restablecer') {
      if (!recovery) return;
      const safe = new URLSearchParams({ type: 'recovery' });
      for (const key of ['token_hash','access_token','refresh_token','error_code']) {
        const value = fragment.get(key) || (key === 'token_hash' ? url.searchParams.get(key) : null);
        if (value) safe.set(key, value);
      }
      window.history.replaceState(null, '', url.pathname);
      window.location.replace('/sistema/restablecer#' + safe.toString());
      return;
    }
    if (fragment.get('error_code')) window.__electoralRecoveryExpired = true;
    const proof = {};
    if (recovery) for (const key of ['token_hash','access_token','refresh_token']) {
      const value = fragment.get(key) || (key === 'token_hash' && queryRecovery ? url.searchParams.get(key) : null);
      if (value) proof[key] = value;
    }
    if (url.searchParams.get('code')) proof.code = url.searchParams.get('code');
    if (Object.keys(proof).length) window.__electoralRecovery = proof;
    window.history.replaceState(null, '', '/sistema/restablecer');
  };
  capture();
  window.addEventListener('hashchange', () => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get('type') === 'recovery' || hash.get('error_code') === 'otp_expired') window.location.reload();
  });
})();`;
