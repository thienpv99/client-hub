param(
  [string]$Out = (Join-Path $PSScriptRoot '..\..\docs\ClientHub-HuongDan.pdf'),
  [string]$GuideUrl = 'http://localhost:8780/docs/guide/index.html',
  [int]$Port = 9339,
  # a private Edge profile per caller: two headless Edges sharing one profile would merge into one process
  [string]$ProfileDir = "$env:TEMP\ch-guide-pdf"
)
# Prints the usage guide (docs/guide/index.html + sections/*.html + shots/) to an A4 PDF with headless Edge.
# Needs the dev server (launch config "client-hub", port 8780). No Node.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'cdp.ps1')

# 1. merge the per-shot sidecars (shots/*.json) into shots/manifest.json
$shots = Join-Path $PSScriptRoot '..\..\docs\guide\shots'
$manifest = @{}
Get-ChildItem $shots -Filter '*.json' | Where-Object { $_.Name -ne 'manifest.json' } | ForEach-Object {
  $manifest[$_.BaseName] = $script:json.DeserializeObject([IO.File]::ReadAllText($_.FullName, [Text.Encoding]::UTF8))
}
[IO.File]::WriteAllText((Join-Path $shots 'manifest.json'), $script:json.Serialize($manifest), (New-Object Text.UTF8Encoding $false))
"manifest: $($manifest.Count) shots"

# 2. print
$profileDir = $ProfileDir
try {
  [void](Start-Edge $Port $profileDir)
  Connect-Page $Port
  Set-Viewport 1240 1754 1 $false
  [void](Send-Cdp 'Emulation.setEmulatedMedia' @{ media = 'print' })
  Go $GuideUrl 'window.__GUIDE_READY__ === true' 180
  $missing = Eval 'JSON.stringify(window.__GUIDE_MISSING__ || [])'
  "missing shots: $missing"
  $footer = '<div style="width:100%;font-family:Segoe UI,sans-serif;font-size:7.5pt;color:#5e6e84;padding:0 15mm;display:flex;justify-content:space-between;">' +
    '<span>Client Hub · Hướng dẫn sử dụng</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'
  $full = [IO.Path]::GetFullPath($Out)
  Save-Pdf $full @{ displayHeaderFooter = $true; headerTemplate = '<span></span>'; footerTemplate = $footer }
  $kb = [int]((Get-Item $full).Length / 1024)
  "pdf: $full ($kb KB)"
} finally {
  Stop-Edge $profileDir
}
