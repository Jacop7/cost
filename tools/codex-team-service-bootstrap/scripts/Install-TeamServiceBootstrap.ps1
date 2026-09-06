[CmdletBinding()]
param(
  [string]$SourceRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$UserRoot = $env:USERPROFILE,
  [switch]$Update,
  [switch]$SkipCodexRegistration
)

$ErrorActionPreference = 'Stop'
$pluginName = 'codex-team-service-bootstrap'
$source = [System.IO.Path]::GetFullPath($SourceRoot)
$user = [System.IO.Path]::GetFullPath($UserRoot)
$targetParent = Join-Path $user 'plugins'
$target = Join-Path $targetParent $pluginName
$marketplace = Join-Path $user '.agents\plugins\marketplace.json'

function Assert-Descendant([string]$Candidate, [string]$Parent) {
  $candidateFull = [System.IO.Path]::GetFullPath($Candidate)
  $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
  if (-not $candidateFull.StartsWith($parentFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "UNSAFE_INSTALL_TARGET:$candidateFull"
  }
}

Assert-Descendant $target $user
Assert-Descendant $marketplace $user
if (-not (Test-Path -LiteralPath (Join-Path $source '.codex-plugin\plugin.json'))) {
  throw "PLUGIN_MANIFEST_MISSING:$source"
}
$manifest = Get-Content -Raw -LiteralPath (Join-Path $source '.codex-plugin\plugin.json') | ConvertFrom-Json
if ($manifest.name -ne $pluginName) { throw "PLUGIN_NAME_MISMATCH:$($manifest.name)" }

$coreTest = Join-Path $source 'tests\team-service-bootstrap.test.mjs'
if (-not (Test-Path -LiteralPath $coreTest)) { throw "PLUGIN_SELF_TESTS_MISSING:$source" }
$test = & node --test $coreTest 2>&1
if ($LASTEXITCODE -ne 0) { throw "PLUGIN_SELF_TEST_FAILED`n$($test -join "`n")" }

New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
if (Test-Path -LiteralPath $target) {
  if (-not $Update) { throw "PLUGIN_ALREADY_EXISTS_USE_UPDATE:$target" }
  $backupRoot = Join-Path $user 'plugins\.backups'
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  $backup = Join-Path $backupRoot ("{0}-{1}" -f $pluginName, (Get-Date -Format 'yyyyMMddHHmmss'))
  Assert-Descendant $backup $user
  Move-Item -LiteralPath $target -Destination $backup
}
Copy-Item -LiteralPath $source -Destination $target -Recurse

$marketplaceParent = Split-Path -Parent $marketplace
New-Item -ItemType Directory -Force -Path $marketplaceParent | Out-Null
$entry = [ordered]@{
  name = $pluginName
  source = [ordered]@{ source = 'local'; path = "./plugins/$pluginName" }
  policy = [ordered]@{ installation = 'AVAILABLE'; authentication = 'ON_INSTALL' }
  category = 'Productivity'
}
if (Test-Path -LiteralPath $marketplace) {
  $catalog = Get-Content -Raw -LiteralPath $marketplace | ConvertFrom-Json
  if ($catalog.name -ne 'personal') { throw "PERSONAL_MARKETPLACE_NAME_MISMATCH:$($catalog.name)" }
  $existing = @($catalog.plugins | Where-Object { $_.name -eq $pluginName })
  if ($existing.Count -gt 1) { throw "DUPLICATE_MARKETPLACE_ENTRY:$pluginName" }
  if ($existing.Count -eq 0) { $catalog.plugins = @($catalog.plugins) + @($entry) }
  elseif ($Update) {
    $catalog.plugins = @($catalog.plugins | Where-Object { $_.name -ne $pluginName }) + @($entry)
  }
  $backupMarketplace = "$marketplace.bak"
  Copy-Item -LiteralPath $marketplace -Destination $backupMarketplace -Force
} else {
  $catalog = [ordered]@{ name = 'personal'; interface = [ordered]@{ displayName = 'Personal' }; plugins = @($entry) }
}
$tempMarketplace = "$marketplace.tmp"
$catalog | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $tempMarketplace -Encoding utf8NoBOM
Move-Item -LiteralPath $tempMarketplace -Destination $marketplace -Force

if (-not $SkipCodexRegistration) {
  $marketplaceName = $catalog.name
  & codex plugin add "$pluginName@$marketplaceName"
  if ($LASTEXITCODE -ne 0) { throw "CODEX_PLUGIN_ADD_FAILED:$LASTEXITCODE" }
}

[ordered]@{
  status = 'PLUGIN_INSTALLED'
  plugin = $pluginName
  version = $manifest.version
  target = $target
  marketplace = $marketplace
  codex_registration_skipped = [bool]$SkipCodexRegistration
  next_action = 'Start a new Codex task so the plugin is loaded.'
} | ConvertTo-Json -Depth 10
