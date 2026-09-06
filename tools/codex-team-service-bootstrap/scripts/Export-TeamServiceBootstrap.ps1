[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [string]$SourceRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$pluginName = 'codex-team-service-bootstrap'
$source = [System.IO.Path]::GetFullPath($SourceRoot)
$output = [System.IO.Path]::GetFullPath($OutputDirectory)
if ([System.IO.Path]::GetPathRoot($output) -eq $output) { throw "UNSAFE_EXPORT_ROOT:$output" }
if (Test-Path -LiteralPath $output) { throw "EXPORT_TARGET_ALREADY_EXISTS:$output" }

$pluginTarget = Join-Path $output "plugins\$pluginName"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $pluginTarget) | Out-Null
Copy-Item -LiteralPath $source -Destination $pluginTarget -Recurse
$marketplace = [ordered]@{
  name = 'codex-team-service-portable'
  interface = [ordered]@{ displayName = 'Codex Team Service Portable' }
  plugins = @([ordered]@{
    name = $pluginName
    source = [ordered]@{ source = 'local'; path = "./plugins/$pluginName" }
    policy = [ordered]@{ installation = 'AVAILABLE'; authentication = 'ON_INSTALL' }
    category = 'Productivity'
  })
}
$marketplace | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $output 'marketplace.json') -Encoding utf8NoBOM
Copy-Item -LiteralPath (Join-Path $source 'scripts\Install-TeamServiceBootstrap.ps1') -Destination (Join-Path $output 'Install-TeamServiceBootstrap.ps1')

$files = Get-ChildItem -LiteralPath $output -File -Recurse | Sort-Object FullName | ForEach-Object {
  [ordered]@{
    path = $_.FullName.Substring($output.Length + 1).Replace('\','/')
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant()
  }
}
$release = [ordered]@{
  schema_version = 1
  package = $pluginName
  version = ((Get-Content -Raw -LiteralPath (Join-Path $source '.codex-plugin\plugin.json') | ConvertFrom-Json).version)
  files = @($files)
}
$release | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $output 'release-inventory.json') -Encoding utf8NoBOM
$releaseHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $output 'release-inventory.json')).Hash.ToLowerInvariant()
[ordered]@{ status = 'PORTABLE_RELEASE_EXPORTED'; path = $output; inventory_sha256 = $releaseHash } | ConvertTo-Json
