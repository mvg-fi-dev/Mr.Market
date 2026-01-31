import { register, init, getLocaleFromNavigator } from 'svelte-i18n';

const LOCALE_STORAGE_KEY = "mrm-locale";
const REGISTERED_LOCALES = new Set(["en-US", "zh-CN"]);

export const initi18n = async () => {
  register('en-US', () => import('./en.json'));
  register('zh-CN', () => import('./zh.json'));
  // register('zh-HK', () => import('.zh-HK/.json'));
  // register('fr', () => import('.fr/.json'));
  // register('es', () => import('.es/.json'));
  // register('de', () => import('.de/.json'));
  // register('ru', () => import('.ru/.json'));
  // register('ar', () => import('.ar/.json'));

  const normalizeLocale = () => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
    if (stored && REGISTERED_LOCALES.has(stored)) {
      return stored;
    }
    const locale = getLocaleFromNavigator();
    if (!locale || locale.startsWith('en-')) {
      return 'en-US';
    }
    return locale;
  };
  
  return await Promise.allSettled([
    init({
      fallbackLocale: 'en-US',
      initialLocale: normalizeLocale(),
    })
  ])
}

export const langs = [
  { name: "English", key: "en-US" },
  { name: "简体中文", key: "zh-CN" },
  { name: "繁體中文", key: "zh-HK" },
  { name: "français", key: "fr" },
  { name: "Deutsch", key: "de" },
  { name: "Español", key: "es" },
  { name: "ру́сский язы́к", key: "ru" },
  { name: "اَلْعَرَبِيَّةُ", key: "ar" },  
]

export const getNameByKey = (k: string) => {
  const lang = langs.find(lang => lang.key === k);
  return lang ? lang.name : "English";
};
