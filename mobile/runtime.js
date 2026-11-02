import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { consumeAuthCallback, safeExportName } from './utils.js';
import config from '../capacitor.config.json';

const callbackScheme = config.appId;
if (Capacitor.isNativePlatform()) {
  document.documentElement.dataset.nativePlatform = Capacitor.getPlatform();
  window.FiexeaNative = {
    redirect: `${callbackScheme}://auth/callback`,
    async shareBlob(blob, name) {
      const path = `exports/${Date.now()}-${safeExportName(name)}`;
      const saved = await Filesystem.writeFile({ path, data: await blob.text(), directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
      try {
        await Share.share({ files: [saved.uri], title: 'Datos de FIEXEA', dialogTitle: 'Guardar o compartir' });
      } finally {
        // Retain the URI long enough for Android's chosen recipient to finish reading it.
        setTimeout(() => Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {}), 15 * 60 * 1000);
      }
    }
  };
  const acceptCallback = async (url) => {
    const target = await consumeAuthCallback(url, callbackScheme, sessionStorage);
    if (!target) return;
    await Browser.close().catch(() => {});
    window.location.replace(target);
  };
  App.addListener('appUrlOpen', ({ url }) => acceptCallback(url));
  App.getLaunchUrl().then(result => { if (result?.url) acceptCallback(result.url); });
  App.addListener('resume', () => window.dispatchEvent(new Event('focus')));
  App.addListener('backButton', () => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(el => !el.hidden && el.getClientRects().length);
    const dialog = dialogs.at(-1);
    if (dialog) {
      const close = dialog.querySelector('button[aria-label="Cerrar"], .premium-close, .csv-export-close');
      if (close) { close.click(); return; }
      return;
    }
    const active = document.querySelector('section.active[id^="t"], .tab.active[id^="t"]');
    if (active && active.id !== 't0' && typeof window.tab === 'function') { window.tab(0); return; }
    App.minimizeApp();
  });
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download')) return;
    const url = new URL(link.href, location.href);
    if (url.protocol === 'https:' && url.origin !== location.origin) {
      event.preventDefault();
      Browser.open({ url: url.href }).catch(() => alert('No se pudo abrir el enlace.'));
    }
  });
}
