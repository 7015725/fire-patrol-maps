import { useEffect, useState } from "react";

/**
 * 前台界面可选偏好（仅存 localStorage，按浏览器生效）：
 * - hamburgerNav：手机端把导航折叠进汉堡菜单
 * - stackFormsMobile：手机端表单纵向整行堆叠 + 触控精调
 * body class: pref-hamburger / pref-stack-forms，CSS 见 styles/theme.css。
 */
export type UiPrefs = {
  hamburgerNav: boolean;
  stackFormsMobile: boolean;
};

export const UI_PREFS_KEY = "facilityMaps.uiPrefs";

export const DEFAULT_UI_PREFS: UiPrefs = {
  hamburgerNav: false,
  stackFormsMobile: false,
};

const CHANGE_EVENT = "uiprefs-changed";

function toBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function loadUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (!raw) return { ...DEFAULT_UI_PREFS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { ...DEFAULT_UI_PREFS };
    }
    const obj = parsed as Record<string, unknown>;
    return {
      hamburgerNav: toBool(obj.hamburgerNav, DEFAULT_UI_PREFS.hamburgerNav),
      stackFormsMobile: toBool(obj.stackFormsMobile, DEFAULT_UI_PREFS.stackFormsMobile),
    };
  } catch {
    return { ...DEFAULT_UI_PREFS };
  }
}

export function applyUiPrefs(prefs: UiPrefs): void {
  document.body.classList.toggle("pref-hamburger", prefs.hamburgerNav);
  document.body.classList.toggle("pref-stack-forms", prefs.stackFormsMobile);
}

export function saveUiPrefs(prefs: UiPrefs): void {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode: preferences won't persist, still apply for this session */
  }
  applyUiPrefs(prefs);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** 全局偏好：任意实例 update 后，所有实例与 body class 同步。 */
export function useUiPrefs(): [UiPrefs, (patch: Partial<UiPrefs>) => void] {
  const [prefs, setPrefs] = useState<UiPrefs>(loadUiPrefs);

  useEffect(() => {
    applyUiPrefs(prefs);
    const onChange = () => setPrefs(loadUiPrefs());
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [prefs]);

  function update(patch: Partial<UiPrefs>): void {
    saveUiPrefs({ ...loadUiPrefs(), ...patch });
  }

  return [prefs, update];
}

/** 汉堡菜单状态（顶栏用）：enabled=偏好开；open=当前是否展开。 */
export function useHamburgerNav(): {
  enabled: boolean;
  open: boolean;
  toggle: () => void;
  close: () => void;
} {
  const [prefs] = useUiPrefs();
  const [open, setOpen] = useState(false);
  return {
    enabled: prefs.hamburgerNav,
    open,
    toggle: () => setOpen((value) => !value),
    close: () => setOpen(false),
  };
}
