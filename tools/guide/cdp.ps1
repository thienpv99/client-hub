# Minimal Chrome DevTools Protocol client for Microsoft Edge (Windows PowerShell 5.1, no Node).
# Dot-source it:  . .\cdp.ps1 ; $edge = Start-Edge ; Connect-Page ; Set-Viewport 1440 900 ; Go 'http://...' ; Shot 'a.png'
Add-Type -AssemblyName System.Web.Extensions
$script:json = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$script:json.MaxJsonLength = [int]::MaxValue
$script:json.RecursionLimit = 1000
$script:ws = $null
$script:msgId = 0
$script:edgeExe = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

function Start-Edge([int]$Port = 9333, [string]$ProfileDir = "$env:TEMP\ch-guide-edge") {
  $argv = @('--headless=new', "--remote-debugging-port=$Port", "--user-data-dir=`"$ProfileDir`"", '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--force-color-profile=srgb',
    '--window-size=1440,900', '--lang=vi-VN', '--accept-lang=vi-VN,vi', 'about:blank')
  $p = Start-Process -FilePath $script:edgeExe -ArgumentList $argv -PassThru
  for ($i = 0; $i -lt 100; $i++) {
    try { $t = Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 2; if ($t) { return $p } } catch { }
    Start-Sleep -Milliseconds 200
  }
  throw 'Edge did not open its debugging port'
}

function Connect-Page([int]$Port = 9333) {
  $targets = Invoke-RestMethod "http://127.0.0.1:$Port/json/list"
  $page = @($targets | Where-Object { $_.type -eq 'page' })[0]
  if (-not $page) { throw 'no page target' }
  $script:ws = New-Object System.Net.WebSockets.ClientWebSocket
  $script:ws.Options.KeepAliveInterval = [TimeSpan]::FromSeconds(30)
  $script:ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  [void](Send-Cdp 'Page.enable')
  [void](Send-Cdp 'Runtime.enable')
}

function Receive-Msg([int]$TimeoutSec = 90) {
  $buf = New-Object byte[] 4194304
  $ms = New-Object IO.MemoryStream
  $cts = New-Object Threading.CancellationTokenSource ([TimeSpan]::FromSeconds($TimeoutSec))
  do {
    $seg = New-Object 'ArraySegment[byte]' -ArgumentList (, $buf)
    $r = $script:ws.ReceiveAsync($seg, $cts.Token).GetAwaiter().GetResult()
    $ms.Write($buf, 0, $r.Count)
  } while (-not $r.EndOfMessage)
  return [Text.Encoding]::UTF8.GetString($ms.ToArray())
}

function Send-Cdp([string]$Method, [hashtable]$Params = @{}, [int]$TimeoutSec = 90) {
  $script:msgId++
  $myId = $script:msgId
  $payload = $script:json.Serialize(@{ id = $myId; method = $Method; params = $Params })
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $seg = New-Object 'ArraySegment[byte]' -ArgumentList (, $bytes)
  $script:ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
  while ($true) {
    $o = $script:json.DeserializeObject((Receive-Msg $TimeoutSec))
    if ($o.ContainsKey('id') -and $o['id'] -eq $myId) {
      if ($o.ContainsKey('error')) { throw "$Method failed: $($o['error']['message'])" }
      return $o['result']
    }
  }
}

# Evaluate JS in the page (awaits promises) and return the JSON-able value.
function Eval([string]$Expression, [int]$TimeoutSec = 90) {
  $r = Send-Cdp 'Runtime.evaluate' @{ expression = $Expression; awaitPromise = $true; returnByValue = $true; timeout = $TimeoutSec * 1000 } ($TimeoutSec + 5)
  if ($r.ContainsKey('exceptionDetails')) {
    $d = $r['exceptionDetails']
    $msg = if ($d.ContainsKey('exception') -and $d['exception'].ContainsKey('description')) { $d['exception']['description'] } else { $d['text'] }
    throw "JS error: $msg"
  }
  return $r['result']['value']
}

function Set-Viewport([int]$Width, [int]$Height, [double]$Scale = 2, [bool]$Mobile = $false) {
  [void](Send-Cdp 'Emulation.setDeviceMetricsOverride' @{ width = $Width; height = $Height; deviceScaleFactor = $Scale; mobile = $Mobile })
  [void](Send-Cdp 'Emulation.setTouchEmulationEnabled' @{ enabled = $Mobile; maxTouchPoints = $(if ($Mobile) { 5 } else { 1 }) })
}

function Go([string]$Url, [string]$ReadyJs = 'document.readyState === "complete"', [int]$TimeoutSec = 60) {
  [void](Send-Cdp 'Page.navigate' @{ url = $Url })
  Wait-Js $ReadyJs $TimeoutSec
}

function Wait-Js([string]$Condition, [int]$TimeoutSec = 30) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try { if (Eval "Boolean($Condition)" 10) { return } } catch { }
    Start-Sleep -Milliseconds 200
  }
  throw "timeout waiting for: $Condition"
}

# Screenshot of the viewport (or a clip {x,y,width,height}); jpeg keeps the PDF small.
function Shot([string]$Path, [string]$Format = 'jpeg', [int]$Quality = 88, [hashtable]$Clip = $null) {
  $p = @{ format = $Format; captureBeyondViewport = $false }
  if ($Format -eq 'jpeg') { $p.quality = $Quality }
  if ($Clip) { $p.clip = @{ x = $Clip.x; y = $Clip.y; width = $Clip.width; height = $Clip.height; scale = 1 } }
  $r = Send-Cdp 'Page.captureScreenshot' $p
  [IO.File]::WriteAllBytes($Path, [Convert]::FromBase64String($r['data']))
}

# Real mouse click at viewport CSS coordinates (Radix menus open on pointerdown, so el.click() is not enough).
function Click-At([double]$X, [double]$Y) {
  [void](Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mouseMoved'; x = $X; y = $Y })
  [void](Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mousePressed'; x = $X; y = $Y; button = 'left'; buttons = 1; clickCount = 1 })
  [void](Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mouseReleased'; x = $X; y = $Y; button = 'left'; buttons = 0; clickCount = 1 })
}

function Hover-At([double]$X, [double]$Y) {
  [void](Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mouseMoved'; x = $X; y = $Y })
}

# Click the element a JS expression returns (e.g. "__g.byText('Thêm khách hàng')"); scrolls it into view first.
function Click-El([string]$ElementJs) {
  $c = Eval "(() => { const el = $ElementJs; if (!el) throw new Error('not found: ' + $($script:json.Serialize($ElementJs))); el.scrollIntoView({ block: 'center', inline: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()"
  Click-At $c['x'] $c['y']
}

function Type-Text([string]$Text) {
  [void](Send-Cdp 'Input.insertText' @{ text = $Text })
}

$script:keyCodes = @{ Enter = 13; Escape = 27; Tab = 9; Backspace = 8; ArrowDown = 40; ArrowUp = 38; ArrowLeft = 37; ArrowRight = 39; Space = 32 }
function Press([string]$Key, [int]$Modifiers = 0) {
  $code = $script:keyCodes[$Key]
  $k = if ($Key -eq 'Space') { ' ' } else { $Key }
  $base = @{ key = $k; code = $(if ($Key -eq 'Space') { 'Space' } else { $Key }); windowsVirtualKeyCode = $code; nativeVirtualKeyCode = $code; modifiers = $Modifiers }
  $down = $base.Clone(); $down.type = 'keyDown'; if ($Key -eq 'Enter') { $down.text = "`r" }
  $up = $base.Clone(); $up.type = 'keyUp'
  [void](Send-Cdp 'Input.dispatchKeyEvent' $down)
  [void](Send-Cdp 'Input.dispatchKeyEvent' $up)
}

# Inject a script into every new document of the page (e.g. tools/guide/helpers.js).
function Add-InitScript([string]$Source) {
  [void](Send-Cdp 'Page.addScriptToEvaluateOnNewDocument' @{ source = $Source })
  [void](Eval $Source)
}

function Save-Pdf([string]$Path, [hashtable]$Options = @{}) {
  $o = @{ printBackground = $true; preferCSSPageSize = $true; transferMode = 'ReturnAsStream' }
  foreach ($k in $Options.Keys) { $o[$k] = $Options[$k] }
  $r = Send-Cdp 'Page.printToPDF' $o 300
  $handle = $r['stream']
  $fs = [IO.File]::Open($Path, 'Create')
  try {
    while ($true) {
      $chunk = Send-Cdp 'IO.read' @{ handle = $handle; size = 2097152 }
      [byte[]]$data = @()
      if ($chunk['data']) {
        if ($chunk['base64Encoded']) { $data = [Convert]::FromBase64String($chunk['data']) } else { $data = [Text.Encoding]::UTF8.GetBytes($chunk['data']) }
      }
      if ($data.Length -gt 0) { $fs.Write($data, 0, $data.Length) }
      if ($chunk['eof']) { break }
    }
  } finally { $fs.Close() }
  [void](Send-Cdp 'IO.close' @{ handle = $handle })
}

# ---------------- guide capture helpers ----------------
$script:guideRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\docs\guide'))
$script:shotDir = Join-Path $script:guideRoot 'shots'
$script:appUrl = 'http://localhost:8780/dist/ClientHub-demo.html'
$script:shotSize = 'desktop'

# Open the standalone build with the page helpers injected. Port/profile let several captures run side by side.
function Start-Guide([int]$Port = 9333, [string]$ProfileDir = "$env:TEMP\ch-guide-edge", [string]$AppUrl = $script:appUrl) {
  $script:appUrl = $AppUrl
  $script:profileDir = $ProfileDir
  New-Item -ItemType Directory -Force $script:shotDir | Out-Null
  [void](Start-Edge $Port $ProfileDir)
  Connect-Page $Port
  Add-InitScript ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'helpers.js'), [Text.Encoding]::UTF8))
  Use-Desktop
  Go $AppUrl 'window.__g && document.querySelector("#root") && document.querySelector("#root").children.length > 0' 90
  [void](Eval '__g.idle()')
}

function Use-Desktop([int]$Width = 1440, [int]$Height = 900) { Set-Viewport $Width $Height 1.5 $false; $script:shotSize = 'desktop' }
function Use-Phone([int]$Width = 390, [int]$Height = 844) { Set-Viewport $Width $Height 2 $true; $script:shotSize = 'phone' }

# Sign in through a demo card on the login page ('Giám đốc', 'Quản lý khách hàng', 'Người quyết định', 'Thành viên')
# or the internal member link ('Thành viên nội bộ').
function Login-As([string]$CardText) {
  # the signed-in viewer also lives in memory: clear the stored session, then reload so the app starts signed out
  [void](Eval '__g.signOut(); location.hash = "#/login"; true')
  [void](Send-Cdp 'Page.reload' @{ ignoreCache = $false })
  Start-Sleep -Milliseconds 300
  Wait-Js 'window.__g && document.querySelector("#root") && document.querySelector("#root").children.length > 0 && location.hash.startsWith("#/login")' 60
  [void](Eval '__g.idle()')
  Click-El "__g.byText($($script:json.Serialize($CardText)), 'button,a')"
  Wait-Js '!location.hash.startsWith("#/login")' 20
  [void](Eval '__g.idle()')
}

function Nav([string]$Path) { [void](Eval "__g.nav($($script:json.Serialize($Path)))") }
function Idle([int]$QuietMs = 450) { [void](Eval "__g.idle($QuietMs)") }

# Run JS that calls __g.mark(n, el, opts) for each callout; returns how many marks were placed.
function Mark([string]$Js) { return Eval "(() => { $Js; return __g.marks.length; })()" }

# Screenshot + sidecar JSON (callouts, size). tools/guide/build-pdf.ps1 merges the sidecars into shots/manifest.json.
function Save-Shot([string]$Id, [switch]$KeepFocus) {
  if (-not $KeepFocus) { [void](Eval '__g.tidy()') }
  Start-Sleep -Milliseconds 250
  $marks = Eval '__g.takeMarks()'
  $file = "$Id.jpg"
  Shot (Join-Path $script:shotDir $file) 'jpeg' 86
  $entry = @{ file = $file; size = $script:shotSize; marks = @($marks); t = [DateTimeOffset]::Now.ToUnixTimeSeconds() }
  [IO.File]::WriteAllText((Join-Path $script:shotDir "$Id.json"), $script:json.Serialize($entry), (New-Object Text.UTF8Encoding $false))
  return $file
}

function Stop-Edge([string]$ProfileDir = "$env:TEMP\ch-guide-edge") {
  try { if ($script:ws) { $script:ws.Dispose() } } catch { }
  # only the headless instance that uses our private profile (never the user's own Edge windows)
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($ProfileDir) } |
    ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch { } }
}
