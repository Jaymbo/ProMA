<script lang="ts">
  import '../app.pcss';
  import { locale, t } from '#lib/i18n/index.svelte';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();
</script>

<svelte:head>
  <link rel="icon" href="%sveltekit.assets%/favicon.svg" />
</svelte:head>

<header>
  <nav>
    <a href="/" class="brand">{t('app_name')}</a>
    <div class="links">
      <a href="/map">{t('nav_map')}</a>
      <a href="/">{t('nav_list')}</a>
      <a href="/report" class="cta">{t('nav_report')}</a>
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
  }
  .links a {
    text-decoration: none;
    color: #333;
  }
  .links a.cta {
    background: #1a73e8;
    color: #fff;
    padding: 0.35rem 0.8rem;
    border-radius: 6px;
  }
  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }
</style>
