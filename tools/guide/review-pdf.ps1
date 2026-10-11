param(
  [string]$File = '/docs/ClientHub-HuongDan.pdf',
  [string]$OutDir = "$env:TEMP\ch-guide-review",
  [int]$From = 1,
  [int]$To = 9999,
  [double]$Scale = 1.1,
  [int]$Port = 9341,
  # a private Edge profile per caller: two headless Edges sharing one profile would merge into one process
  [string]$ProfileDir = "$env:TEMP\ch-guide-review-edge"
)
# Renders PDF pages to JPEG files (via pdf.js in headless Edge) so they can be looked at one by one.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'cdp.ps1')
New-Item -ItemType Directory -Force $OutDir | Out-Null
$profileDir = $ProfileDir
try {
  [void](Start-Edge $Port $profileDir)
  Connect-Page $Port
  $url = "http://localhost:8780/tools/guide/pdf-preview.html?file=$([Uri]::EscapeDataString($File))&scale=$Scale&from=$From&to=$To"
  Go $url 'window.__PDF__ !== undefined' 240
  $info = Eval 'JSON.stringify({ pages: __PDF__.pages, error: __PDF__.error, n: (__PDF__.rendered || []).length })'
  "info: $info"
  $n = Eval '(__PDF__.rendered || []).length'
  for ($i = 0; $i -lt $n; $i++) {
    $data = Eval "__PDF__.rendered[$i].split(',')[1]"
    $page = $From + $i
    $path = Join-Path $OutDir ('page-{0:D2}.jpg' -f $page)
    [IO.File]::WriteAllBytes($path, [Convert]::FromBase64String($data))
    $path
  }
} finally {
  Stop-Edge $profileDir
}
