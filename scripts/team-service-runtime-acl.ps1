param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Configure', 'Probe')]
  [string]$Mode,
  [Parameter(Mandatory = $true)]
  [string]$Path,
  [string]$ExpectedOwnerSid
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-Sha256Text([string]$Value) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Get-Sha256File([string]$FilePath) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($FilePath)
  try {
    return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
  } finally {
    $stream.Dispose()
    $sha.Dispose()
  }
}

function Resolve-ContainedPath([string]$InputPath) {
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'LOCALAPPDATA_KNOWN_FOLDER_REQUIRED' }
  $base = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Codex-Team-Service'))
  $resolved = [System.IO.Path]::GetFullPath($InputPath)
  $prefix = $base.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $resolved.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'ACL_PATH_OUTSIDE_RUNTIME_ROOT' }
  if ($resolved.IndexOf([System.IO.Path]::DirectorySeparatorChar + 'OneDrive' + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
    throw 'ONEDRIVE_RUNTIME_FORBIDDEN'
  }
  $cursor = $resolved
  while ($cursor) {
    if (Test-Path -LiteralPath $cursor) {
      $item = Get-Item -LiteralPath $cursor -Force
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'REPARSE_PATH_FORBIDDEN' }
    }
    if ($cursor -eq $base) { break }
    $parent = [System.IO.Directory]::GetParent($cursor)
    if ($null -eq $parent) { break }
    $cursor = $parent.FullName
  }
  return $resolved
}

function Get-TokenInfo {
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [System.Security.Principal.WindowsPrincipal]::new($identity)
  return [ordered]@{
    sid = $identity.User.Value
    is_admin = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
  }
}

$resolvedPath = Resolve-ContainedPath $Path
$token = Get-TokenInfo

if ($Mode -eq 'Configure') {
  [System.IO.Directory]::CreateDirectory($resolvedPath) | Out-Null
  $secretPath = Join-Path $resolvedPath 'acl-probe.txt'
  [System.IO.File]::WriteAllText($secretPath, 'team-service-acl-probe', [System.Text.UTF8Encoding]::new($false))

  $ownerSid = [System.Security.Principal.SecurityIdentifier]::new($token.sid)
  $systemSid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
  $inheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
  $directoryAcl = [System.Security.AccessControl.DirectorySecurity]::new()
  $directoryAcl.SetAccessRuleProtection($true, $false)
  $directoryAcl.SetOwner($ownerSid)
  $directoryAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($ownerSid, 'FullControl', $inheritance, 'None', 'Allow'))
  $directoryAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($systemSid, 'FullControl', $inheritance, 'None', 'Allow'))
  ([System.IO.DirectoryInfo]::new($resolvedPath)).SetAccessControl($directoryAcl)

  $fileAcl = [System.Security.AccessControl.FileSecurity]::new()
  $fileAcl.SetAccessRuleProtection($true, $false)
  $fileAcl.SetOwner($ownerSid)
  $fileAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($ownerSid, 'FullControl', 'Allow'))
  $fileAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($systemSid, 'FullControl', 'Allow'))
  ([System.IO.FileInfo]::new($secretPath)).SetAccessControl($fileAcl)

  $sections = [System.Security.AccessControl.AccessControlSections]::Access -bor [System.Security.AccessControl.AccessControlSections]::Owner -bor [System.Security.AccessControl.AccessControlSections]::Group
  $actual = ([System.IO.FileInfo]::new($secretPath)).GetAccessControl($sections)
  $actualOwner = $actual.Owner
  try { $actualOwner = ([System.Security.Principal.NTAccount]$actual.Owner).Translate([System.Security.Principal.SecurityIdentifier]).Value } catch {}
  if ($actualOwner -ne $token.sid) { throw 'ACL_OWNER_MISMATCH' }
  if (-not $actual.AreAccessRulesProtected) { throw 'ACL_INHERITANCE_NOT_PROTECTED' }
  $allowed = @($token.sid, 'S-1-5-18')
  foreach ($rule in $actual.Access) {
    $sid = $rule.IdentityReference.Value
    try { $sid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value } catch {}
    if ($rule.AccessControlType -eq 'Allow' -and $sid -notin $allowed) { throw "ACL_BROAD_ALLOW_FORBIDDEN:$sid" }
    if ($rule.IsInherited) { throw 'ACL_UNEXPECTED_INHERITANCE' }
  }
  $ownerRead = [System.IO.File]::ReadAllText($secretPath)
  if ($ownerRead -ne 'team-service-acl-probe') { throw 'ACL_OWNER_READ_FAILED' }
  $sddl = $actual.Sddl
  [ordered]@{
    schema_version = 1
    mode = 'CONFIGURE'
    resolved_path = $resolvedPath
    probe_file = $secretPath
    owner_sid = $token.sid
    sddl = $sddl
    sddl_sha256 = Get-Sha256Text $sddl
    checker_sha256 = Get-Sha256File $PSCommandPath
    principal_type = 'OWNER'
    owner_read_result = 'PASS'
    other_principal_denial_result = 'ACL_NEGATIVE_UNVERIFIED'
  } | ConvertTo-Json -Compress
  exit 0
}

if ([string]::IsNullOrWhiteSpace($ExpectedOwnerSid)) { throw 'EXPECTED_OWNER_SID_REQUIRED' }
if ($token.sid -eq $ExpectedOwnerSid) { throw 'OTHER_TOKEN_MUST_DIFFER_FROM_OWNER' }
if ($token.is_admin) { throw 'OTHER_TOKEN_MUST_BE_NON_ADMIN' }
$probeFile = Join-Path $resolvedPath 'acl-probe.txt'
$denied = $false
try {
  [System.IO.File]::ReadAllText($probeFile) | Out-Null
} catch [System.UnauthorizedAccessException] {
  $denied = $true
}
if (-not $denied) { throw 'OTHER_NON_ADMIN_READ_WAS_NOT_DENIED' }
[ordered]@{
  schema_version = 1
  mode = 'PROBE'
  resolved_path = $resolvedPath
  probe_file = $probeFile
  owner_sid = $ExpectedOwnerSid
  probe_sid = $token.sid
  principal_type = 'OTHER_NON_ADMIN'
  other_principal_denial_result = 'PASS'
} | ConvertTo-Json -Compress
exit 0
