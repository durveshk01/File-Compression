param([ValidateRange(1, 65535)][int]$Port = 8000)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$pythonCommand = Get-Command python -ErrorAction Stop
$pythonPath = $pythonCommand.Source
& $pythonPath -c "import sys; assert sys.version_info >= (3, 11), 'Python 3.11 or later is required'"
if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.11 or later and make python available on PATH.' }
$environmentPath = Join-Path $PSScriptRoot '.smartcompress-venv'
$environmentPython = Join-Path $environmentPath 'Scripts/python.exe'
if (!(Test-Path -LiteralPath $environmentPython)) {
    & $pythonPath -m venv $environmentPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the Python environment.' }
}
& $environmentPython -c "import importlib.util, sys; sys.exit(0 if all(importlib.util.find_spec(name) for name in ['fastapi', 'uvicorn', 'PIL', 'pymupdf', 'multipart']) else 1)"
if ($LASTEXITCODE -ne 0) {
    & $environmentPython -m pip install --require-hashes -r requirements.lock
    if ($LASTEXITCODE -ne 0) { throw 'Dependencies could not be installed. Check your internet connection.' }
}
Write-Host "SmartCompress: http://127.0.0.1:$Port (Ctrl+C to stop)"
& $environmentPython -m uvicorn services.compressor.api:app --host 127.0.0.1 --port $Port --no-access-log
if ($LASTEXITCODE -ne 0) { throw 'The server stopped with an error. Check that the port is available.' }
