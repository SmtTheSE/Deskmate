# Desktop app (Windows, Mac, Linux)

The simplest way to try Deskmate, or to run it for one office. Download, double-click, done. No Docker, no terminal, no account with a hosting company.

## Install

1. Download the installer for your computer from the project's **Releases** page:
   - **Windows:** `Deskmate-Setup-x.y.z.exe`
   - **Mac:** `Deskmate-x.y.z.dmg` (open it and drag Deskmate into Applications)
   - **Linux:** `Deskmate-x.y.z.AppImage`
2. Open Deskmate. The setup wizard appears with your setup code already filled in. Press **Get started**.

> The first builds are not code-signed yet, so Windows may say "Windows protected your PC" (choose **More info → Run anyway**) and a Mac may say the developer cannot be verified (right-click the app, choose **Open**, then **Open** again). This goes away once the project buys signing certificates.

## Things to know

- **Your data stays on this computer**, in one folder. Use the menu **Help desk → Show my data folder** to find it, and **How to back up** for simple instructions.
- **Only this computer can use it at first.** To let colleagues and visitors on the same network (for example the school Wi-Fi) use the help form and the staff console, turn on **Help desk → Let others on our network use it** and restart. Deskmate then shows the address to share. Keep the computer switched on while people use it.
- **Text messages and email from outside** need a public web address, which a desktop computer usually doesn't have. When you are ready for that, move to a cloud deploy ([DEPLOY.md](DEPLOY.md)) by copying your data folder across.

## For developers

```sh
npm run build                 # build the web app first
cd apps/desktop
npm start                     # run the desktop app from source
npm run dist                  # build an installer for the current OS into apps/desktop/release
```

The server and the Electron main process are bundled into plain JavaScript with esbuild (`scripts/bundle.mjs`), and the web app is shipped as an extra resource. Installers for all three systems are built by `.github/workflows/desktop.yml` on every `v*` tag.
