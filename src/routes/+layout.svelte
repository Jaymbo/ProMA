<script lang="ts">
  import '../app.pcss';
  import { page } from '$app/state';
  import { locale, t } from '#lib/i18n/index.svelte';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();

  const current = $derived(page.url.pathname);
  const isActive = (href: string): boolean =>
    href === '/' ? current === '/' : current.startsWith(href);
</script>

<svelte:head>
  <link rel="icon" href="%sveltekit.assets%/favicon.svg" />
  <link rel="manifest" href="%sveltekit.assets%/manifest.json" />
  <meta name="theme-color" content="#1a73e8" />
  <meta
    name="description"
    content="ProMA: Anonym städtische Probleme melden – Foto, Standort, Community-Votes. Ohne Account, ohne personenbezogene Daten."
  />
  <meta property="og:title" content="ProMA – Problem Melde App" />
  <meta property="og:description" content="Anonym städtische Probleme melden. Ohne Account." />
  <meta property="og:type" content="website" />
</svelte:head>

<header>
  <nav>
    <a href="/" class="brand">{t('app_name')}</a>
    <div class="links">
      <a href="/map" class:active={isActive('/map')}>{t('nav_map')}</a>
      <a href="/" class:active={isActive('/')}>{t('nav_list')}</a>
      <a href="/report" class="cta" class:active={isActive('/report')}>{t('nav_report')}</a>
    </div>
    <select
      aria-label="Language"
      value={locale.get()}
      onchange={(e) => locale.set((e.currentTarget as HTMLSelectElement).value as 'de' | 'en')}
    >
      <option value="de">DE</option>
      <option value="en">EN</option>
    </select>
  </nav>
</header>

<main>
  {@render children()}
</main>

<footer>
  <p>
    🔒 Anonym · Keine personenbezogenen Daten · Erledigte Meldungen werden nach 30 Tagen gelöscht
  </p>
</footer>

<style>
  header {
    border-bottom: 1px solid #ddd;
    background: #fff;
    position: sticky;
    top: 0;
    z-index: 1000;
  }
  nav {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    max-width: 1200px;
    margin: 0 auto;
    flex-wrap: wrap;
  }
  .brand {
    font-weight: 700;
    color: #1a73e8;
    text-decoration: none;
  }
  .links {
    display: flex;
    gap: 1rem;
    flex: 1;
    flex-wrap: wrap;
  }
  .links a {
    text-decoration: none;
    color: #333;
    padding-bottom: 2px;
    border-bottom: 2px solid transparent;
  }
  .links a.active {
    font-weight: 600;
    border-bottom-color: #1a73e8;
  }
  .links a.cta {
    background: #1a73e8;
    color: #fff;
    padding: 0.35rem 0.8rem;
    border-radius: 6px;
    border-bottom: none;
  }
  .links a.cta.active {
    outline: 2px solid #0b47a8;
    outline-offset: 1px;
  }
  nav select {
    padding: 0.25rem 0.5rem;
    border: 1px solid #dadce0;
    border-radius: 6px;
    background: #fff;
  }
  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }
  footer {
    border-top: 1px solid #ddd;
    margin-top: 2rem;
    padding: 1rem;
    text-align: center;
  }
  footer p {
    color: #5f6368;
    font-size: 0.85rem;
    margin: 0;
    max-width: 1200px;
    margin: 0 auto;
  }
</style>
