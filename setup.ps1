# Auuki setup + launcher — Windows (PowerShell)
# Usage: right-click → "Run with PowerShell"
#        or from a terminal: powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/vasantharam/auuki_with_video.git"
$RepoDir = "auuki_with_video"
$Port    = 3000

Write-Host ""
Write-Host "  Auuki — indoor cycling app" -ForegroundColor White
Write-Host "  =============================" -ForegroundColor White
Write-Host ""

# ── git ──────────────────────────────────────────────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Download and install Git for Windows from:"
    Write-Host "  https://git-scm.com/download/win"
    Write-Host ""
    Write-Host "  After installing, close this window and run setup.ps1 again."
    Read-Host "Press Enter to exit"
    exit 1
}

# ── clone or update ───────────────────────────────────────────────────────────
if (Test-Path (Join-Path $RepoDir ".git")) {
    Write-Host "Updating Auuki..." -ForegroundColor Green
    git -C $RepoDir pull --ff-only
} else {
    Write-Host "Downloading Auuki..." -ForegroundColor Green
    git clone $RepoUrl $RepoDir
}

Set-Location $RepoDir
$DistPath = Resolve-Path "dist"

Write-Host ""
Write-Host "Starting Auuki on http://localhost:$Port" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop."
Write-Host ""

# open browser after a short delay
Start-Job -ScriptBlock {
    param($url)
    Start-Sleep -Seconds 2
    Start-Process $url
} -ArgumentList "http://localhost:$Port" | Out-Null

# ── try Python first (handles video range requests natively) ──────────────────
$python = $null
foreach ($cmd in @("python", "python3", "py")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $python = $cmd
        break
    }
}

if ($python) {
    Write-Host "  Using Python ($python)" -ForegroundColor Gray
    & $python -m http.server $Port --directory dist --bind 127.0.0.1
    exit
}

# ── try node / npx ───────────────────────────────────────────────────────────
if ((Get-Command node -ErrorAction SilentlyContinue) -and
    (Get-Command npm  -ErrorAction SilentlyContinue)) {
    Write-Host "  Using Node.js / npx serve" -ForegroundColor Gray
    npx --yes serve dist --listen $Port --no-clipboard
    exit
}

# ── built-in PowerShell HTTP server (no external tools needed) ───────────────
Write-Host "  Using built-in PowerShell server" -ForegroundColor Gray
Write-Host "  (Install Python for better video support: https://python.org/downloads)" -ForegroundColor Yellow
Write-Host ""

$mimeMap = @{
    ".html"  = "text/html; charset=utf-8"
    ".css"   = "text/css"
    ".js"    = "application/javascript"
    ".json"  = "application/json"
    ".svg"   = "image/svg+xml"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".ico"   = "image/x-icon"
    ".mp4"   = "video/mp4"
    ".webm"  = "video/webm"
    ".woff2" = "font/woff2"
    ".woff"  = "font/woff"
    ".txt"   = "text/plain"
    ".csv"   = "text/csv"
    ".webmanifest" = "application/manifest+json"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

try {
    while ($listener.IsListening) {
        $ctx  = $listener.GetContext()
        $req  = $ctx.Request
        $resp = $ctx.Response

        $localPath = $req.Url.LocalPath
        if ($localPath -eq "/") { $localPath = "/index.html" }
        $filePath = Join-Path $DistPath ($localPath.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar))

        if (Test-Path $filePath -PathType Leaf) {
            $ext  = [IO.Path]::GetExtension($filePath).ToLower()
            $mime = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { "application/octet-stream" }
            $bytes = [IO.File]::ReadAllBytes($filePath)

            # Basic range request support for video
            $rangeHeader = $req.Headers["Range"]
            if ($rangeHeader -and $rangeHeader -match "bytes=(\d+)-(\d*)") {
                $start = [long]$Matches[1]
                $end   = if ($Matches[2]) { [long]$Matches[2] } else { $bytes.Length - 1 }
                $len   = $end - $start + 1
                $resp.StatusCode = 206
                $resp.AddHeader("Content-Range", "bytes $start-$end/$($bytes.Length)")
                $resp.ContentType = $mime
                $resp.ContentLength64 = $len
                $resp.OutputStream.Write($bytes, [int]$start, [int]$len)
            } else {
                $resp.StatusCode = 200
                $resp.ContentType = $mime
                $resp.ContentLength64 = $bytes.Length
                $resp.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } else {
            $resp.StatusCode = 404
        }
        $resp.Close()
    }
} finally {
    $listener.Stop()
}
