// Entry point: boots the renderer, menus and (optionally) the LAN client.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './styles.css';
import { App } from './app';
import { Screens } from './ui/screens';
import { installLan } from './ui/lan';
import { loadKeymaps } from './input/devices';

loadKeymaps();

const app = new App();
const screens = new Screens(app);
installLan(screens);
screens.showTitle();

// Debug/test hooks (used by the automated browser smoke test).
(window as unknown as Record<string, unknown>).__tofu = { app, screens };
