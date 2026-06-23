<#
中文：一键启动 AMATUIUCDatabase 的本地日常开发服务。
English: One-click local daily startup for AMATUIUCDatabase development services.
#>

param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function ConvertTo-SingleQuotedPowerShellLiteral([string]$Value) {
  return "'" + ($Value -replace "'", "''") + "'"
}

function Assert-CommandExists([string]$CommandName, [string]$InstallHint) {
  if (Get-Command $CommandName -ErrorAction SilentlyContinue) {
    return
  }

  throw "Missing command '$CommandName'. $InstallHint"
}

function Assert-PathExists([string]$Path, [string]$SetupHint) {
  if (Test-Path -LiteralPath $Path) {
    return
  }

  throw "Missing path '$Path'. $SetupHint"
}

function Start-DevServiceWindow(
  [string]$Title,
  [string]$WorkingDirectory,
  [string]$Command
) {
  if ($DryRun) {
    Write-Host "[dry-run] Would start $Title in $WorkingDirectory"
    Write-Host $Command
    return
  }

  Start-Process `
    -FilePath 'powershell.exe' `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Normal `
    -ArgumentList @(
      '-NoExit',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      $Command
    )
}

$ProjectRoot = $PSScriptRoot
$FrontendRoot = Join-Path $ProjectRoot 'frontend'
$PythonExe = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
$DockerComposeFile = Join-Path $ProjectRoot 'docker-compose.yml'
$FrontendPackage = Join-Path $FrontendRoot 'package.json'
$FrontendNodeModules = Join-Path $FrontendRoot 'node_modules'

Assert-PathExists $DockerComposeFile 'Run this script from the repository root, or restore docker-compose.yml.'
Assert-PathExists $PythonExe 'Create the virtual environment and install dependencies first: python -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt'
Assert-PathExists $FrontendPackage 'The frontend package.json was not found.'
Assert-PathExists $FrontendNodeModules 'Install frontend dependencies first: cd frontend; npm install'
Assert-CommandExists 'docker' 'Install Docker Desktop and make sure it is running.'
Assert-CommandExists 'npm.cmd' 'Install Node.js/npm.'

Write-Host 'Starting PostgreSQL container...'
if ($DryRun) {
  Write-Host '[dry-run] docker compose up -d'
} else {
  Push-Location $ProjectRoot
  try {
    docker compose up -d
  } finally {
    Pop-Location
  }
}

$ProjectRootLiteral = ConvertTo-SingleQuotedPowerShellLiteral $ProjectRoot
$FrontendRootLiteral = ConvertTo-SingleQuotedPowerShellLiteral $FrontendRoot

$BackendCommand = @"
Set-Location -LiteralPath $ProjectRootLiteral
`$Host.UI.RawUI.WindowTitle = 'AMAT Backend API'
& .\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
"@

$FrontendCommand = @"
Set-Location -LiteralPath $FrontendRootLiteral
`$Host.UI.RawUI.WindowTitle = 'AMAT Frontend Vite'
& npm.cmd run dev
"@

Start-DevServiceWindow 'Backend API' $ProjectRoot $BackendCommand
Start-DevServiceWindow 'Frontend Vite' $FrontendRoot $FrontendCommand

Write-Host ''
Write-Host 'Startup commands sent.'
Write-Host 'Backend API: http://127.0.0.1:8000'
Write-Host 'API docs:    http://127.0.0.1:8000/docs'
Write-Host 'Frontend:    Vite will print the URL, usually http://localhost:5173'
Write-Host ''
Write-Host 'Close backend/frontend by pressing Ctrl+C in their service windows.'
Write-Host 'Stop the database later with: docker compose down'
