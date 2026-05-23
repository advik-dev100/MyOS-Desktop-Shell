const { app, BrowserWindow, screen, ipcMain, shell, Tray, Menu, nativeImage } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync, exec } = require('child_process')
const { Registry } = require('rage-edit')

let win, tray

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds
  win = new BrowserWindow({
    width, height,
    x: 0, y: 0,
    frame: false,
    transparent: true,
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    }
  })
  win.loadFile('src/index.html')
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setFullScreenable(true)
  win.setVisibleOnAllWorkspaces(true)
}

function createTray() {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('MyOS')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show MyOS', click: () => win.show() },
    { label: 'Exit', click: () => app.quit() }
  ]))
}

function registerStartup() {
  const exePath = process.execPath
  const appPath = `"${exePath}" "${path.join(__dirname, '.')}"`
  try {
    const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    execSync(`reg add "${regKey}" /v "MyOS" /t REG_SZ /d "${process.execPath} --app-path \\"${__dirname}\\"" /f`)
  } catch(e) {
    console.log('Startup reg:', e.message)
  }
}

ipcMain.handle('register-startup', () => {
  try {
    const startupFolder = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
    const batContent = `@echo off\nstart "" "${process.execPath}" "${__dirname}"`
    const batPath = path.join(startupFolder, 'MyOS.bat')
    fs.writeFileSync(batPath, batContent)
    return { success: true, path: batPath }
  } catch(e) { return { success: false, error: e.message } }
})

ipcMain.handle('remove-startup', () => {
  try {
    const batPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'MyOS.bat')
    if(fs.existsSync(batPath)) fs.unlinkSync(batPath)
    return { success: true }
  } catch(e) { return { success: false, error: e.message } }
})

ipcMain.handle('get-files', async (e, dirPath) => {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
    return items.map(item => ({
      name: item.name,
      isDir: item.isDirectory(),
      path: path.join(dirPath, item.name),
      ext: path.extname(item.name).toLowerCase()
    }))
  } catch { return [] }
})

ipcMain.handle('get-quick-folders', async () => {
  const user = os.homedir()
  return [
    { name: 'Desktop', path: path.join(user, 'Desktop'), icon: '🖥' },
    { name: 'Documents', path: path.join(user, 'Documents'), icon: '📄' },
    { name: 'Downloads', path: path.join(user, 'Downloads'), icon: '⬇' },
    { name: 'Pictures', path: path.join(user, 'Pictures'), icon: '🖼' },
    { name: 'Music', path: path.join(user, 'Music'), icon: '🎵' },
    { name: 'Videos', path: path.join(user, 'Videos'), icon: '🎬' },
    { name: 'C Drive', path: 'C:\\', icon: '💾' },
    { name: 'D Drive', path: 'D:\\', icon: '📀' }
  ]
})

ipcMain.handle('get-apps', async () => {
  const dirs = [
    'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs',
    os.homedir() + '\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs'
  ]
  let apps = []
  const scan = (d) => {
    try {
      const items = fs.readdirSync(d, { withFileTypes: true })
      items.forEach(item => {
        const full = path.join(d, item.name)
        if(item.isDirectory()) { try { scan(full) } catch {} }
        else if(item.name.endsWith('.lnk')) {
          apps.push({
            name: item.name.replace('.lnk',''),
            path: full,
            letter: item.name.charAt(0).toUpperCase()
          })
        }
      })
    } catch {}
  }
  dirs.forEach(scan)
  return apps.sort((a,b) => a.name.localeCompare(b.name))
})

ipcMain.handle('open-app', async (e, appPath, appName) => {
  shell.openPath(appPath)
  return true
})

ipcMain.handle('open-file', async (e, filePath) => {
  shell.openPath(filePath)
})

ipcMain.handle('get-home-dir', () => os.homedir())

ipcMain.handle('get-system-stats', () => {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const memPercent = Math.round((usedMem / totalMem) * 100)
  const cpus = os.cpus()
  return {
    mem: memPercent,
    totalMem: Math.round(totalMem / 1024 / 1024 / 1024),
    platform: os.platform(),
    hostname: os.hostname(),
    cpuModel: cpus[0]?.model?.split(' ').slice(0,3).join(' ') || 'Unknown',
    cpuCount: cpus.length,
    uptime: Math.floor(os.uptime() / 3600) + 'h ' + Math.floor((os.uptime() % 3600) / 60) + 'm'
  }
})

ipcMain.handle('take-screenshot', () => {
  try {
    const desktop = path.join(os.homedir(), 'Desktop')
    const fname = `MyOS_Screenshot_${Date.now()}.png`
    exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen" `)
    return { success: true, path: path.join(desktop, fname) }
  } catch(e) { return { success: false } }
})

ipcMain.handle('minimize-to-tray', () => {
  win.hide()
})

ipcMain.handle('quit', () => app.quit())

app.whenReady().then(() => {
  createWindow()
  createTray()
})
app.on('window-all-closed', () => {})