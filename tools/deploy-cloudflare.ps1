param(
  [string]$Project = 'clienthub',
  [string]$Domain = 'clienthub.nea.io.vn',
  [string]$Zone = 'nea.io.vn',
  [string]$TokenFile = ''
)
# Deploy dist/ClientHub-demo.html to Cloudflare Pages (Direct Upload, no Node / wrangler) and attach a custom domain.
# Prerequisites:
#   1. tools/build-standalone.html?auto=1  -> dist/ClientHub-demo.html
#   2. tools/pages-manifest.html           -> dist/pages-manifest.json (BLAKE3 hash, as wrangler computes it)
#   3. client-hub/.cloudflare-token        -> API token: Account/Cloudflare Pages:Edit, Zone/Zone:Read, Zone/DNS:Edit
# Usage (from client-hub):  powershell -NoProfile -ExecutionPolicy Bypass -File tools/deploy-cloudflare.ps1
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
if (-not $TokenFile) { $TokenFile = Join-Path $root '.cloudflare-token' }
if (-not (Test-Path -LiteralPath $TokenFile)) { throw "Missing token file: $TokenFile" }
$token = ([IO.File]::ReadAllText($TokenFile)).Trim()
$api = 'https://api.cloudflare.com/client/v4'

function Invoke-CF {
  param([string]$Method, [string]$Path, $Body = $null, [string]$Auth = $token, [string]$ContentType = 'application/json')
  $req = @{ Method = $Method; Uri = "$api$Path"; Headers = @{ Authorization = "Bearer $Auth" }; UseBasicParsing = $true }
  if ($null -ne $Body) {
    $req.Body = [Text.Encoding]::UTF8.GetBytes([string]$Body)
    $req.ContentType = $ContentType
  }
  try {
    $res = Invoke-WebRequest @req
    return ($res.Content | ConvertFrom-Json)
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $reader = New-Object IO.StreamReader($resp.GetResponseStream())
      $text = $reader.ReadToEnd()
      throw "Cloudflare $Method $Path -> HTTP $([int]$resp.StatusCode): $text"
    }
    throw
  }
}

function Try-CF {
  param([string]$Method, [string]$Path, $Body = $null, [string]$Auth = $token, [string]$ContentType = 'application/json')
  try { return Invoke-CF -Method $Method -Path $Path -Body $Body -Auth $Auth -ContentType $ContentType } catch { return $null }
}

# 1. token + zone + account
$verify = Invoke-CF GET '/user/tokens/verify'
"token: $($verify.result.status)"
$zones = Invoke-CF GET "/zones?name=$Zone"
if (-not $zones.result -or $zones.result.Count -eq 0) { throw "Zone $Zone not visible to this token (needs Zone:Read on $Zone)" }
$zoneId = $zones.result[0].id
$accountId = $zones.result[0].account.id
"zone: $Zone ($zoneId), account: $accountId"

# 2. project (create on first run)
$proj = Try-CF GET "/accounts/$accountId/pages/projects/$Project"
if (-not $proj) {
  $body = @{ name = $Project; production_branch = 'main' } | ConvertTo-Json -Compress
  $proj = Invoke-CF POST "/accounts/$accountId/pages/projects" $body
  "project created: $Project"
}
$pagesHost = $proj.result.subdomain
"pages host: $pagesHost"

# 3. asset (one file: the self-contained demo, served as /index.html)
$manifestPath = Join-Path $root 'dist\pages-manifest.json'
$m = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
$filePath = Join-Path $root ($m.source -replace '/', '\')
$bytes = [IO.File]::ReadAllBytes($filePath)
if ($bytes.Length -ne [int]$m.bytes) { throw "pages-manifest.json is stale (size $($m.bytes) vs file $($bytes.Length)). Re-run tools/pages-manifest.html" }
$hash = $m.hash
"asset: $($m.path) $($bytes.Length) bytes, hash $hash"

# 4. upload session (JWT), check-missing, upload, upsert
$tok = Try-CF GET "/accounts/$accountId/pages/projects/$Project/upload-token"
if (-not $tok) { $tok = Invoke-CF POST "/accounts/$accountId/pages/projects/$Project/upload-token" '{}' }
$jwt = $tok.result.jwt
$missing = Invoke-CF POST '/pages/assets/check-missing' (@{ hashes = @($hash) } | ConvertTo-Json -Compress) $jwt
if (@($missing.result) -contains $hash) {
  $b64 = [Convert]::ToBase64String($bytes)
  $payload = '[{"key":"' + $hash + '","value":"' + $b64 + '","metadata":{"contentType":"' + $m.contentType + '"},"base64":true}]'
  $null = Invoke-CF POST '/pages/assets/upload' $payload $jwt
  "uploaded"
} else { "already uploaded" }
$null = Invoke-CF POST '/pages/assets/upsert-hashes' (@{ hashes = @($hash) } | ConvertTo-Json -Compress) $jwt

# 5. deployment
$manifestJson = '{"' + $m.path + '":"' + $hash + '"}'
$boundary = [Guid]::NewGuid().ToString('N')
$nl = "`r`n"
$form = "--$boundary$nl" + 'Content-Disposition: form-data; name="manifest"' + "$nl$nl$manifestJson$nl" +
        "--$boundary$nl" + 'Content-Disposition: form-data; name="branch"' + "$nl${nl}main$nl" +
        "--$boundary--$nl"
$dep = Invoke-CF POST "/accounts/$accountId/pages/projects/$Project/deployments" $form $token "multipart/form-data; boundary=$boundary"
"deployment: $($dep.result.id) $($dep.result.url)"

# 6. custom domain + DNS
$domains = Invoke-CF GET "/accounts/$accountId/pages/projects/$Project/domains"
if (-not (@($domains.result) | Where-Object { $_.name -eq $Domain })) {
  $null = Invoke-CF POST "/accounts/$accountId/pages/projects/$Project/domains" (@{ name = $Domain } | ConvertTo-Json -Compress)
  "custom domain added: $Domain"
} else { "custom domain present: $Domain" }
$records = Invoke-CF GET "/zones/$zoneId/dns_records?name=$Domain"
if (-not $records.result -or $records.result.Count -eq 0) {
  $label = $Domain.Substring(0, $Domain.Length - $Zone.Length - 1)
  $rec = @{ type = 'CNAME'; name = $label; content = $pagesHost; proxied = $true; comment = 'Client Hub (Cloudflare Pages)' } | ConvertTo-Json -Compress
  $null = Invoke-CF POST "/zones/$zoneId/dns_records" $rec
  "dns: CNAME $Domain -> $pagesHost (proxied)"
} else { "dns: record exists for $Domain" }

# 7. wait for the deployment to finish
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 4
  $d = Invoke-CF GET "/accounts/$accountId/pages/projects/$Project/deployments/$($dep.result.id)"
  $stage = $d.result.latest_stage
  "stage: $($stage.name) $($stage.status)"
  if ($stage.name -eq 'deploy' -and $stage.status -eq 'success') { break }
  if ($stage.status -eq 'failure') { throw "deployment failed at $($stage.name)" }
}
"DONE: https://$Domain  (also $($dep.result.url))"
