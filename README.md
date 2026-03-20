# Warehouse Optimizer (Electron)

This project is a self-contained desktop app (Windows installer) built with **Vite + React + Tailwind + Electron**.

## Quick start (dev)

```bash
npm install
npm run patch
```

`patch` starts Vite and opens the Electron window.

## Build a Windows installer (EXE)

```bash
npm install
npm run dist:win
```

Output:
- `release/Warehouse Optimizer Setup 2.4.2.exe` (installer)

## Notes

- The app is offline-capable (no CDN dependencies).
- Excel import/export uses the `xlsx` package.
- The queue view uses paging so the plan fits in the frame without an internal scroll box.
