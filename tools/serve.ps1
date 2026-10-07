param([int]$Port = 8780)
# Dev server without Node (Windows PowerShell): serves this client-hub folder on http://localhost:<Port>/
# Usage (from the client-hub folder):  powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1
# - extensionless module paths resolve to .ts/.tsx/.js (sets X-Resolved-Path; sw.js transpiles TS in the browser)
# - unknown non-asset paths fall back to nobuild.html (SPA routing)
# - GET /__ls lists files under src/; POST /__save?name=<file> writes into dist/ (used by tools/build-standalone.html)
$root = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.ts' = 'text/plain; charset=utf-8'; '.tsx' = 'text/plain; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.pdf' = 'application/pdf'; '.ico' = 'image/x-icon'
  '.woff2' = 'font/woff2'; '.md' = 'text/plain; charset=utf-8'; '.sql' = 'text/plain; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
}
$l = New-Object Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
"Client Hub: http://localhost:$Port/  (Ctrl+C to stop)"

function Send-Bytes($ctx, [byte[]]$b, [string]$type, [string]$resolved) {
  $ctx.Response.ContentType = $type
  $ctx.Response.Headers.Add('Cache-Control', 'no-store')
  if ($resolved) { $ctx.Response.Headers.Add('X-Resolved-Path', $resolved) }
  $ctx.Response.ContentLength64 = $b.Length
  $ctx.Response.OutputStream.Write($b, 0, $b.Length)
}

while ($l.IsListening) {
  $ctx = $l.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '__save' -and $ctx.Request.HttpMethod -eq 'POST') {
      $name = $ctx.Request.QueryString['name']
      if (-not $name -or $name -notmatch '^[A-Za-z0-9._-]+$') { $ctx.Response.StatusCode = 400; continue }
      $distDir = Join-Path $root 'dist'
      if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }
      $ms = New-Object IO.MemoryStream
      $ctx.Request.InputStream.CopyTo($ms)
      [IO.File]::WriteAllBytes((Join-Path $distDir $name), $ms.ToArray())
      Send-Bytes $ctx ([Text.Encoding]::UTF8.GetBytes('{"ok":true,"bytes":' + $ms.Length + '}')) 'application/json; charset=utf-8' $null
      continue
    }
    if ($rel -eq '__ls') {
      $src = Join-Path $root 'src'
      $files = Get-ChildItem $src -Recurse -File | ForEach-Object { '/' + $_.FullName.Substring($root.Length + 1).Replace('\', '/') }
      $json = '[' + (($files | ForEach-Object { '"' + $_ + '"' }) -join ',') + ']'
      Send-Bytes $ctx ([Text.Encoding]::UTF8.GetBytes($json)) 'application/json; charset=utf-8' $null
      continue
    }
    if ($rel -eq '') { $rel = 'nobuild.html' }
    $f = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if (-not $f.StartsWith($root)) { $ctx.Response.StatusCode = 403; continue }
    $resolved = $null
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) {
      $ext0 = [IO.Path]::GetExtension($f)
      if ($ext0 -eq '' -or $rel.StartsWith('src/')) {
        foreach ($cand in @('.ts', '.tsx', '.js', '.mjs')) {
          if (Test-Path -LiteralPath ($f + $cand) -PathType Leaf) { $f = $f + $cand; $resolved = '/' + $rel + $cand; break }
        }
      }
    }
    if (Test-Path -LiteralPath $f -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($f).ToLower()
      $type = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
      Send-Bytes $ctx ([IO.File]::ReadAllBytes($f)) $type $resolved
    } elseif ($rel.StartsWith('src/') -or $rel.StartsWith('vendor/') -or ([IO.Path]::GetExtension($rel) -ne '')) {
      $ctx.Response.StatusCode = 404
    } else {
      Send-Bytes $ctx ([IO.File]::ReadAllBytes((Join-Path $root 'nobuild.html'))) 'text/html; charset=utf-8' $null
    }
  } catch {
    try { $ctx.Response.StatusCode = 500 } catch {}
  } finally {
    try { $ctx.Response.Close() } catch {}
  }
}
